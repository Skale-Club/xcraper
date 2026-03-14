# ⏸️ Comportamento ao Pausar Busca

## 🎯 O Que Acontece Quando Usuário Pausa uma Busca

### ✅ **NOVO COMPORTAMENTO (Implementado)**

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Usuário clica em "Pause Search"                           │
│    POST /api/search/:searchId/pause                          │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. Backend aborta run do Apify                                │
│    await abortTask(apifyRunId)                               │
│    └→ Apify para de coletar novos leads                     │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. Backend busca leads PARCIAIS do dataset                   │
│    const partialResults = await getTaskResults(runId)       │
│    └→ Retorna leads que foram coletados ATÉ O MOMENTO       │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. Backend PROCESSA leads parciais                           │
│    ├→ Aplica filtros (email válido, deduplicação)           │
│    ├→ Calcula créditos (1 ou 3 por lead)                    │
│    └→ Se user = admin → salva SEM cobrar                    │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. Backend DEBITA créditos dos leads parciais                │
│    ├→ Ordem: monthly → rollover → purchased                 │
│    ├→ Cria creditTransaction (type: 'usage', paused: true)  │
│    └→ Cria billingEvent (paused: true)                      │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. Backend SALVA leads parciais no DB                        │
│    await db.insert(contacts).values(contactsToInsert)       │
│    └→ Usuário pode ver e exportar os leads coletados        │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 7. Backend marca search como 'paused'                        │
│    status: 'paused'                                          │
│    totalResults: partialLeadsSaved                           │
│    savedResults: partialLeadsSaved                           │
│    creditsUsed: creditsCharged                               │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ 8. Retorna resposta ao usuário                               │
│    {                                                         │
│      "message": "Search paused successfully",                │
│      "status": "paused",                                     │
│      "partialLeadsSaved": 23,                                │
│      "creditsCharged": 23                                    │
│    }                                                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 Exemplos de Cenários

### **Cenário 1: Busca Standard Pausada (sem email)**

```
User inicia: "restaurants in NYC" (max 100 results, standard)
Apify coleta: 45 leads
User pausa após 2 minutos

Resultado:
✅ 45 leads salvos no DB
✅ 45 créditos debitados (1 crédito cada)
✅ User pode exportar CSV com 45 leads
✅ Search status: 'paused'
```

---

### **Cenário 2: Busca Enriched Pausada (com email)**

```
User inicia: "law firms in LA" (max 50 results, enriched)
Apify coleta: 30 leads
  - 18 com email válido
  - 12 sem email
User pausa após 3 minutos

Resultado:
✅ 18 leads salvos (só os com email)
✅ 54 créditos debitados (18 × 3)
✅ 12 leads descartados (sem email)
✅ Search status: 'paused'
```

---

### **Cenário 3: Admin Pausa Busca**

```
Admin inicia: "tech startups" (max 100 results)
Apify coleta: 67 leads
Admin pausa

Resultado:
✅ 67 leads salvos no DB
✅ 0 créditos debitados (admin bypass)
✅ Transaction criada com metadata: { paused: true, admin: true }
✅ Search status: 'paused'
```

---

### **Cenário 4: Pausa Antes de Coletar QUALQUER Lead**

```
User inicia: "dentists" (max 20 results)
User pausa após 5 segundos
Apify ainda não coletou nenhum lead (dataset vazio)

Resultado:
✅ 0 leads salvos
✅ 0 créditos debitados
✅ Search status: 'paused'
⚠️ User não perdeu créditos mas também não ganhou nada
```

---

### **Cenário 5: Deduplicação em Pausa**

```
User já tem 10 leads de "pizza NYC" salvos há 15 dias
User inicia nova busca "pizza NYC" (max 50)
Apify coleta 25 leads
  - 8 são duplicados (mesmo placeId)
  - 17 são novos
User pausa

Resultado:
✅ 17 leads salvos (só os novos)
✅ 17 créditos debitados
✅ 8 duplicados pulados (chargeForDuplicates = false)
✅ Transaction metadata: { duplicatesSkipped: 8, paused: true }
```

---

## 🔍 Como Identificar Buscas Pausadas

### **No Dashboard do Usuário:**

```typescript
// frontend/src/pages/DashboardPage.tsx
{search.status === 'paused' && (
  <Badge variant="warning">
    ⏸️ Paused - {search.savedResults} leads saved
  </Badge>
)}
```

### **No Banco de Dados:**

```sql
-- Ver buscas pausadas com leads parciais
SELECT
  id,
  query,
  location,
  status,
  saved_results,
  credits_used,
  created_at
FROM search_history
WHERE status = 'paused'
  AND saved_results > 0
ORDER BY created_at DESC;
```

### **Nas Transações:**

```sql
-- Ver transações de buscas pausadas
SELECT
  ct.id,
  ct.user_id,
  ct.amount,
  ct.description,
  ct.metadata->>'paused' as is_paused,
  ct.metadata->>'standardResults' as standard,
  ct.metadata->>'enrichedResults' as enriched,
  ct.created_at
FROM credit_transactions ct
WHERE ct.metadata->>'paused' = 'true'
ORDER BY ct.created_at DESC;
```

---

## ⚠️ Casos Especiais

### **1. Erro ao Buscar Leads Parciais**

Se `getTaskResults()` falhar (ex: dataset inacessível):

```typescript
try {
  const partialResults = await getTaskResults(runId);
  // ... process and save
} catch (resultsError) {
  console.error('Error fetching partial results:', resultsError);
  // Continue with pause even if can't get partial results
}

// Search é marcado como 'paused' de qualquer forma
// partialLeadsSaved = 0
// creditsCharged = 0
```

**Resultado:**
- ✅ Search marcado como 'paused'
- ✅ Não cobra créditos
- ⚠️ Usuário não recebe leads (mas também não paga)

---

### **2. Usuário Sem Créditos Suficientes**

```
User tem: 10 créditos disponíveis
Busca pausada com: 25 leads coletados
Custo: 25 créditos

Resultado:
✅ Só salva 10 leads (até atingir limite de créditos)
✅ Cobra 10 créditos
✅ 15 leads descartados (sem créditos para pagar)
⚠️ Transaction metadata: { partial: true, creditsLimited: true }
```

---

### **3. Auto Top-Up Durante Pausa**

Se usuário tem auto top-up habilitado:

```
User tem: 5 créditos
Busca pausada com: 30 leads
Auto top-up: 250 créditos ($5.90)

Resultado:
❌ Auto top-up NÃO é trigado durante pause
✅ Só salva 5 leads
✅ Cobra 5 créditos
⚠️ User precisa fazer top-up manual para salvar mais
```

**Motivo:** Pause é ação intencional do usuário, não deve gastar mais créditos automaticamente.

---

## 🎨 UI Recomendada

### **Botão de Pause:**

```tsx
{search.status === 'running' && (
  <Button
    variant="outline"
    onClick={() => pauseSearch(search.id)}
  >
    ⏸️ Pause & Save Partial Results
  </Button>
)}
```

### **Modal de Confirmação:**

```tsx
<AlertDialog>
  <AlertDialogTitle>Pause Search?</AlertDialogTitle>
  <AlertDialogDescription>
    This will stop the search and save any leads collected so far.

    Estimated partial results: {estimatedPartialLeads}
    Credits will be charged: {estimatedCredits}

    You can export the partial results after pausing.
  </AlertDialogDescription>
  <AlertDialogAction onClick={confirmPause}>
    Pause & Save
  </AlertDialogAction>
</AlertDialog>
```

### **Após Pausar:**

```tsx
<Card variant="success">
  <CardHeader>
    <CardTitle>✅ Search Paused Successfully</CardTitle>
  </CardHeader>
  <CardContent>
    <p>{partialLeadsSaved} leads were saved</p>
    <p>{creditsCharged} credits were charged</p>

    <Button onClick={() => exportCSV(searchId)}>
      📥 Download Partial Results (CSV)
    </Button>
  </CardContent>
</Card>
```

---

## 📋 Checklist de Implementação

### Backend ✅
- [x] Buscar leads parciais ao pausar
- [x] Processar e filtrar leads (email, deduplicação)
- [x] Calcular e cobrar créditos
- [x] Salvar leads parciais no DB
- [x] Criar transactions com metadata `paused: true`
- [x] Bypass para admin
- [x] Error handling se dataset inacessível

### Frontend (PENDENTE)
- [ ] Botão "Pause Search" no dashboard
- [ ] Modal de confirmação com estimativa
- [ ] Badge/indicator para buscas pausadas
- [ ] Mensagem de sucesso com stats
- [ ] Botão de export CSV para buscas pausadas
- [ ] Tooltip explicando o comportamento

---

## 🧪 Como Testar

### 1. **Teste Manual:**

```bash
# 1. Iniciar busca
curl -X POST http://localhost:3001/api/search \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "coffee shops",
    "location": "Seattle, WA",
    "maxResults": 100,
    "requestEnrichment": false
  }'

# Copiar searchId da resposta

# 2. Aguardar ~30s (Apify vai coletar alguns leads)

# 3. Pausar busca
curl -X POST http://localhost:3001/api/search/{searchId}/pause \
  -H "Authorization: Bearer $JWT"

# Resposta esperada:
# {
#   "message": "Search paused successfully",
#   "status": "paused",
#   "partialLeadsSaved": 23,  # Quantidade de leads coletados até pausar
#   "creditsCharged": 23       # Créditos debitados
# }

# 4. Verificar leads salvos
curl http://localhost:3001/api/search/{searchId}/results \
  -H "Authorization: Bearer $JWT"

# 5. Exportar CSV
curl http://localhost:3001/api/contacts/export/csv/search/{searchId} \
  -H "Authorization: Bearer $JWT" \
  > partial_results.csv
```

---

### 2. **Teste de Deduplicação:**

```bash
# 1. Fazer busca completa e deixar terminar
POST /api/search { "query": "pizza", "location": "NYC", "maxResults": 50 }

# 2. Fazer MESMA busca e pausar logo depois
POST /api/search { "query": "pizza", "location": "NYC", "maxResults": 50 }
# Aguardar 20s
POST /api/search/{searchId}/pause

# Resultado esperado:
# partialLeadsSaved < leads totais coletados
# duplicatesSkipped > 0 (no metadata)
```

---

### 3. **Teste Admin:**

```bash
# Login como admin
# Fazer busca e pausar

# Verificar:
# creditsCharged = 0
# partialLeadsSaved > 0
# Transaction criada mas amount = 0
```

---

## 📊 Métricas para Monitorar

```sql
-- Taxa de pause (% de buscas que são pausadas)
SELECT
  COUNT(*) FILTER (WHERE status = 'paused') * 100.0 / COUNT(*) as pause_rate
FROM search_history
WHERE created_at > NOW() - INTERVAL '7 days';

-- Média de leads salvos em buscas pausadas
SELECT
  AVG(saved_results) as avg_partial_leads,
  AVG(credits_used) as avg_credits_charged
FROM search_history
WHERE status = 'paused'
  AND saved_results > 0;

-- Receita de buscas pausadas
SELECT
  SUM(ABS(amount)) as total_credits_from_paused
FROM credit_transactions
WHERE metadata->>'paused' = 'true';
```

---

**Última Atualização:** 2026-03-14 23:58 UTC
**Implementado Por:** Claude (Sonnet 4.5)
