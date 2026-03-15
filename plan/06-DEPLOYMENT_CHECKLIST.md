# 🚀 Checklist de Deploy para Produção

**Versão:** 1.0.0
**Data:** 2026-03-14

---

## 🔴 CRÍTICO - Antes do Deploy

### 1. Stripe Webhook Secrets (OBRIGATÓRIO)
```env
# backend/.env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
STRIPE_PAYMENTS_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

**Como configurar:**
1. Acessar https://dashboard.stripe.com/webhooks
2. Criar endpoint: `https://seu-dominio.com/api/payments/webhook`
3. Eventos: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copiar webhook secret
5. Adicionar ao `.env`
6. Repetir para subscriptions endpoint

### 2. Variáveis de Ambiente

```env
# Production
NODE_ENV=production
FRONTEND_URL=https://xcraper.com
BACKEND_URL=https://api.xcraper.com

# Database
DATABASE_URL=postgresql://user:pass@host:5432/xcraper_prod

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# Apify
APIFY_API_TOKEN=apify_api_xxx

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PAYMENTS_WEBHOOK_SECRET=whsec_xxx
STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET=whsec_xxx
```

### 3. Build e Testes

```bash
# Backend
cd backend
npm run build
npm test

# Frontend
cd frontend
npm run build
npm run preview
```

---

## 🟡 Importante

### 4. Database Migrations

```bash
cd backend
npm run db:migrate
```

### 5. Seed Settings (primeira vez)

```bash
npm run db:seed
```

### 6. SSL/TLS

- ✅ Certificado SSL configurado
- ✅ HTTPS ativo
- ✅ Redirect HTTP → HTTPS

### 7. Monitoramento

- ✅ Logs centralizados
- ✅ Alertas de erro
- ✅ Alertas de custos Apify
- ✅ Monitoramento de margem

---

## 🟢 Nice-to-have

### 8. Backups

- ✅ Backup automático do PostgreSQL (diário)
- ✅ Backup de variáveis de ambiente

### 9. Rate Limiting

- ✅ Configurar Cloudflare ou similar
- ✅ DDoS protection

### 10. Performance

- ✅ CDN para frontend
- ✅ Caching de assets
- ✅ Compressão gzip

---

## 📊 Pós-Deploy

### Validação em Produção

```bash
# 1. Health check
curl https://api.xcraper.com/api/health

# 2. Fazer 1 busca de teste
# Verificar custo real no Apify Console

# 3. Testar webhook do Stripe
stripe trigger payment_intent.succeeded --api-key sk_live_xxx

# 4. Verificar logs
tail -f /var/log/xcraper/app.log
```

### Monitorar por 24h

- ✅ Custos Apify vs previsão
- ✅ Taxa de erro < 1%
- ✅ Latência média < 2s
- ✅ Webhooks sendo recebidos

---

## 🚨 Rollback Plan

Se algo der errado:

```bash
# 1. Reverter deploy
git revert HEAD
git push

# 2. Rebuild anterior
npm run build

# 3. Restart services
pm2 restart xcraper-backend
```

---

**Última Atualização:** 2026-03-14 00:25 UTC
