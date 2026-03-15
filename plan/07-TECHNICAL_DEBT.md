# 🔧 Débito Técnico e Melhorias Futuras

**Versão:** 1.0.0
**Data:** 2026-03-14

---

## 🔴 Urgente (Esta Semana)

### 1. Configurar Stripe Webhook Secrets
- **Status:** 🟡 Pendente
- **Risco:** Alto (vulnerabilidade de segurança)
- **Esforço:** 5 minutos
- **Descrição:** Sem secrets, webhooks podem ser forjados

### 2. Testes End-to-End
- **Status:** 🟡 Pendente
- **Risco:** Médio (bugs em produção)
- **Esforço:** 2 horas
- **Descrição:** Testar fluxo completo: signup → busca → export → purchase

---

## 🟡 Importante (Próximas 2 Semanas)

### 3. Frontend do Comportamento de Pausa
- **Status:** 🟡 Pendente
- **Risco:** Baixo (feature não crítica)
- **Esforço:** 4 horas
- **Tarefas:**
  - [ ] Botão "Pause Search" no dashboard
  - [ ] Modal de confirmação
  - [ ] Badge para buscas pausadas
  - [ ] Mensagem de sucesso
  - [ ] Export CSV para buscas pausadas

### 4. Streaming de Leads em Tempo Real (SSE)
- **Status:** 🟡 Pendente
- **Risco:** Baixo (melhoria de UX)
- **Esforço:** 8 horas
- **Descrição:** 
  - Usuário vê leads aparecerem aos poucos
  - Pode pausar quando tiver suficiente
  - Feedback visual de progresso

### 5. Dashboard de P&L
- **Status:** 🟡 Pendente
- **Risco:** Baixo (visibilidade de negócio)
- **Esforço:** 6 horas
- **Features:**
  - Custos Apify em tempo real
  - Receita vs custos
  - Margem de lucro
  - Alertas quando margem < 50%

---

## 🟢 Nice-to-have (Próximo Mês)

### 6. Bulk Search (CSV Upload)
- **Esforço:** 8 horas
- **Descrição:** Upload de CSV com múltiplas queries

### 7. Caching de Resultados (24h)
- **Esforço:** 4 horas
- **Descrição:** Busca idêntica retorna cache em 24h

### 8. Webhook API para Clientes
- **Esforço:** 6 horas
- **Descrição:** Cliente recebe webhook quando busca completa

### 9. Email Notifications
- **Esforço:** 4 horas
- **Tipos:**
  - Welcome email
  - Search completed
  - Credits low
  - Purchase receipt

### 10. Advanced Filters
- **Esforço:** 6 horas
- **Filtros:**
  - Rating mínimo
  - Review count mínimo
  - Por categoria
  - Por localização específica

---

## 🔧 Melhorias Técnicas

### Code Quality

#### Testes Unitários
- **Cobertura atual:** 0%
- **Meta:** 80%
- **Esforço:** 12 horas
- **Áreas críticas:**
  - creditRules.ts
  - apify.ts
  - userRateLimit.ts

#### Type Safety
- **Melhorias:**
  - Zod schemas para todos os endpoints
  - Type guards para responses do Apify
  - Strict mode no TypeScript

#### Error Handling
- **Melhorias:**
  - Error classes customizadas
  - Logging estruturado (Winston/Pino)
  - Error tracking (Sentry)

---

## 📊 Performance

### Database Optimizations

#### Índices Necessários
```sql
-- search_history
CREATE INDEX idx_search_user_status ON search_history(user_id, status);
CREATE INDEX idx_search_created ON search_history(created_at DESC);

-- contacts
CREATE INDEX idx_contacts_user ON contacts(user_id);
CREATE INDEX idx_contacts_search ON contacts(search_id);
CREATE INDEX idx_contacts_place_id ON contacts(place_id);

-- credit_transactions
CREATE INDEX idx_transactions_user_created ON credit_transactions(user_id, created_at DESC);
```

#### Query Optimizations
- Pagination em todas as listagens
- Eager loading de relações
- Connection pooling

### API Optimizations
- Response compression (gzip)
- API response caching
- Rate limiting per endpoint

---

## 🛡️ Segurança

### Vulnerabilidades Conhecidas

1. **Stripe Webhook sem Secret** 🔴 CRÍTICO
2. **Rate limiting global** (precisa ser por IP também)
3. **Input sanitization** (XSS protection)
4. **SQL injection** (já protegido por Drizzle)

### Melhorias de Segurança

- [ ] Helmet headers mais restritivos
- [ ] CORS whitelist específico
- [ ] API key rotation automática
- [ ] 2FA para admin
- [ ] Audit log de ações admin

---

## 📈 Escalabilidade

### Quando Atingir 1000 Usuários

1. **Horizontal Scaling**
   - Load balancer (Nginx/Cloudflare)
   - Múltiplas instâncias do backend
   - Redis para session storage

2. **Database**
   - Read replicas
   - Connection pooling (PgBouncer)
   - Partitioning de tabelas grandes

3. **Apify**
   - Batch processing
   - Queue system (Bull/BeeQueue)
   - Concurrent limits por tier

---

## 💰 Custo de Implementação

| Item | Prioridade | Esforço | ROI |
|------|-----------|---------|-----|
| Stripe Secrets | 🔴 | 5min | Alto |
| Testes E2E | 🔴 | 2h | Alto |
| Frontend Pausa | 🟡 | 4h | Médio |
| SSE Streaming | 🟡 | 8h | Alto |
| Dashboard P&L | 🟡 | 6h | Alto |
| Bulk Search | 🟢 | 8h | Médio |
| Caching | 🟢 | 4h | Alto |
| Email Notifications | 🟢 | 4h | Médio |

**Total esforço crítico:** 2h 5min
**Total esforço importante:** 18h
**Total esforço nice-to-have:** 34h

---

## 📝 Notas

### Decisões Arquiteturais

1. **Por que não usar filas (Bull/Redis)?**
   - Volume atual não justifica
   - Apify já gerencia filas
   - Adicionar quando > 1000 buscas/dia

2. **Por que não SSE agora?**
   - Apify não suporta DATASET.ITEM_ADDED
   - Precisaria polling frequente (caro)
   - Melhor implementar quando volume justificar

3. **Por que manter polling + webhooks?**
   - Redundância para casos de webhook failure
   - Polling reduzido (só confirma o que webhook indicou)

---

**Última Atualização:** 2026-03-14 00:30 UTC
**Criado Por:** Claude (Sonnet 4.5)
