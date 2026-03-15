# 🧪 Guia Completo de Testes - Xcraper

**Versão:** 1.0.0
**Data:** 2026-03-14

---

## 📋 Testes Principais

### 1. Teste de Proteção de Imagens
```bash
curl -X POST http://localhost:3001/api/search \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"query":"restaurants","location":"New York, NY","maxResults":20,"requestEnrichment":false}'
```
**Validar no Apify Console:**
- ✅ Image scraped: 0
- ✅ Custo total: ~$0.087 (não $2.00+)

### 2. Teste de Rate Limiting
```bash
# Iniciar 3 buscas em paralelo
for i in {1..3}; do
  curl -X POST http://localhost:3001/api/search \
    -H "Authorization: Bearer $JWT" \
    -d "{\"query\":\"test$i\",\"location\":\"NYC\",\"maxResults\":5}" &
done

# 4ª busca deve retornar HTTP 429
```

### 3. Teste de Pausa
```bash
# 1. Iniciar busca
curl -X POST http://localhost:3001/api/search ... 

# 2. Aguardar 30s

# 3. Pausar
curl -X POST http://localhost:3001/api/search/{searchId}/pause \
  -H "Authorization: Bearer $JWT"
```
**Validar:**
- ✅ Leads parciais salvos
- ✅ Créditos cobrados proporcionalmente
- ✅ CSV exportável

Ver documentação completa em PAUSE_BEHAVIOR.md

---

**Tempo Total:** ~25 minutos
