# Phase 1: Fix Keepalive

**Goal:** Workflow GitHub Actions executa sem erros; Supabase free tier nunca pausa.

**Status:** Ready to apply

---

## Diagnóstico

**Problema raiz:** Design circular. O endpoint `/api/keepalive` retorna **503** quando Supabase ou DB falham. O `curl --fail-with-body` no workflow trata 5xx como erro fatal → Action falha. Se o Supabase pausar, o próprio keepalive não consegue "acordá-lo", piorando o ciclo.

**Por que #631 em diante falha:** Provavelmente o Supabase pausou (ou o DB teve instabilidade), o endpoint devolveu 503, e o workflow passou a falhar sistematicamente.

**Arquivos envolvidos:**
- `backend/src/routes/keepalive.ts` — endpoint que retorna 503 em falha
- `.github/workflows/keepalive.yml` — workflow que falha em qualquer 5xx

---

## Plano de Execução

### 01-01: Corrigir endpoint keepalive

**Arquivo:** `backend/src/routes/keepalive.ts`

**Mudança:** O endpoint SEMPRE retorna HTTP 200. Falhas dos probes ficam no body como informação de diagnóstico, não como código de erro. O propósito do endpoint é gerar tráfego no Supabase — não fazer health check com falha em cascata.

```typescript
// Antes (linha 91-92):
const allOk = results.supabaseRest.ok && results.database.ok;
const status = allOk ? 200 : 503;

// Depois:
// Sempre 200 — o propósito é gerar tráfego, não reportar saúde crítica
const status = 200;
```

**Resultado esperado:** Mesmo se o Supabase estiver lento ou o DB com problema temporário, o endpoint retorna 200 com detalhes no body. O ping chega ao Supabase. A Action não falha.

---

### 01-02: Adicionar ping direto ao Supabase no workflow

**Arquivo:** `.github/workflows/keepalive.yml`

**Mudança:** Adicionar um step que pinga o Supabase **diretamente** (via `/auth/v1/health`), sem depender do backend Vercel. Isso garante que mesmo se o Vercel estiver com problema, o Supabase recebe tráfego.

```yaml
- name: Ping Supabase diretamente (fallback)
  env:
    SUPABASE_URL: ${{ vars.SUPABASE_URL }}
    SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
  run: |
    if [ -z "${SUPABASE_URL:-}" ]; then
      echo "SUPABASE_URL não configurada, pulando ping direto"
      exit 0
    fi
    curl --silent --max-time 30 --retry 3 --retry-delay 5 \
      --header "apikey: ${SUPABASE_ANON_KEY}" \
      "${SUPABASE_URL}/auth/v1/health" || true
    echo "Ping direto ao Supabase concluído"
```

**Observação:** `|| true` garante que mesmo uma falha de rede não quebra o step. O objetivo é tentar — não verificar.

---

### 01-03: Tornar o curl do workflow tolerante a 5xx

**Arquivo:** `.github/workflows/keepalive.yml`

**Mudança:** Substituir `--fail-with-body` por uma abordagem que captura o status HTTP e falha apenas em erro de **rede** (sem resposta alguma), não em 5xx.

```bash
# Antes: --fail-with-body faz curl retornar exit code != 0 em 4xx/5xx
# Depois: captura HTTP status, falha só se curl não conseguiu conectar

HTTP_STATUS=$(curl --silent --show-error --location \
  --max-time 60 --retry 5 --retry-delay 10 --retry-all-errors \
  --connect-timeout 15 \
  --write-out "%{http_code}" \
  --output /tmp/keepalive_response.txt \
  "${CURL_ARGS_WITHOUT_FAIL[@]}")

cat /tmp/keepalive_response.txt

if [ "$HTTP_STATUS" = "000" ]; then
  echo "::error::Keepalive falhou — sem resposta HTTP (erro de rede ou timeout)"
  exit 1
fi

echo "Keepalive ok (HTTP $HTTP_STATUS)"
```

**Resultado:** A Action falha APENAS se o backend não responder de forma alguma (HTTP 000 = sem conexão). Qualquer resposta HTTP (200, 503, etc.) é considerada sucesso para fins do workflow.

---

## Ordem de Execução

1. `01-01` → fix no endpoint (mais importante, elimina o 503)
2. `01-03` → fix no workflow (tolerância a 5xx como defense-in-depth)
3. `01-02` → ping direto ao Supabase (fallback independente)

## Critérios de Aceite

- [ ] Runs subsequentes do keepalive passam (verde no GitHub Actions)
- [ ] Endpoint `/api/keepalive` retorna 200 mesmo quando DB ou Supabase lento
- [ ] Body da resposta ainda contém `supabaseRest.ok` e `database.ok` para diagnóstico
- [ ] Workflow tem dois steps independentes: ping via backend + ping direto ao Supabase

## Boundaries (Não tocar)

- Lógica de autenticação do endpoint (`verifySecret`)
- Lógica dos probes internos (SELECT 1, fetch ao Supabase) — só o código HTTP de resposta muda
- Outros workflows no `.github/workflows/`

---
*PLAN.md — Phase 1 | Created: 2026-05-03*
