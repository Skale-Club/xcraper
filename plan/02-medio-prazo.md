# Médio Prazo (1 mês) - Prioridade ALTA

Melhorias importantes para robustez operacional e experiência do usuário.

## 📧 1. Email Notifications

**Estimativa**: 3-4 dias

### Setup Email Service

- [ ] Escolher provider (Resend, SendGrid, ou AWS SES)
- [ ] Configurar credenciais
- [ ] Adicionar variáveis ao `.env`:
  ```env
  EMAIL_PROVIDER=resend
  EMAIL_API_KEY=re_xxxxx
  EMAIL_FROM=noreply@xcraper.com
  EMAIL_FROM_NAME=Xcraper
  ```

### Criar Email Templates

- [ ] Criar `backend/src/templates/emails/`
- [ ] Template: Welcome email
  ```html
  - Boas-vindas
  - Explicação do sistema de créditos
  - Link para tutorial/onboarding
  - Créditos iniciais recebidos
  ```

- [ ] Template: Low credits warning
  ```html
  - Alerta: créditos abaixo de 10
  - CTA para comprar mais
  - Link para pricing
  ```

- [ ] Template: Search completed
  ```html
  - Busca finalizada
  - Número de resultados
  - Link direto para resultados
  ```

- [ ] Template: Purchase confirmation
  ```html
  - Recibo de compra
  - Créditos adicionados
  - Novo balance
  - Link para invoice
  ```

- [ ] Template: Account deleted
  ```html
  - Confirmação de exclusão
  - Data de remoção dos dados
  - Contato para suporte
  ```

### Implementar Email Service

- [ ] Criar `backend/src/services/email.ts`
  ```typescript
  interface EmailParams {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }

  export async function sendEmail(params: EmailParams) {
    // Implementação com provider escolhido
  }

  export async function sendWelcomeEmail(user: User) {
    await sendEmail({
      to: user.email,
      subject: 'Welcome to Xcraper!',
      html: renderWelcomeTemplate(user)
    });
  }

  export async function sendLowCreditsWarning(user: User) {
    // ...
  }

  export async function sendSearchCompleted(user: User, search: SearchHistory) {
    // ...
  }
  ```

### Integrar com Eventos

- [ ] Email de boas-vindas: após signup (`/api/auth/sync`)
- [ ] Low credits: quando balance < 10 (após dedução)
- [ ] Search completed: quando Apify callback recebe status 'completed'
- [ ] Purchase confirmed: após webhook Stripe success

### Email Preferences

- [ ] Adicionar tabela `email_preferences`
  ```typescript
  {
    userId: uuid;
    welcomeEmails: boolean;
    lowCreditsAlerts: boolean;
    searchCompletedAlerts: boolean;
    marketingEmails: boolean;
    createdAt: timestamp;
    updatedAt: timestamp;
  }
  ```

- [ ] Migração
- [ ] UI em Settings para gerenciar preferências
- [ ] Respeitar preferências antes de enviar

### Unsubscribe

- [ ] Criar endpoint `/api/email/unsubscribe/:token`
- [ ] Gerar token único por usuário
- [ ] Link de unsubscribe em todos emails
- [ ] Atualizar preferências ao clicar

---

## 🔄 2. Contact Deduplication

**Estimativa**: 2-3 dias

### Estratégia de Deduplicação

Evitar cobrar usuário por contatos já salvos.

#### Opção A: Check before save (Recomendado)
- [ ] Antes de salvar, verificar se contato já existe
- [ ] Base de comparação:
  - Mesmo `userId`
  - Mesmo `title` (nome do negócio)
  - Mesmo `phone` OU mesmo `address`

- [ ] Criar `backend/src/services/contacts.ts`
  ```typescript
  async function isDuplicate(userId: string, contact: Partial<Contact>) {
    const existing = await db.select()
      .from(contacts)
      .where(and(
        eq(contacts.userId, userId),
        eq(contacts.title, contact.title),
        or(
          eq(contacts.phone, contact.phone),
          eq(contacts.address, contact.address)
        )
      ))
      .limit(1);

    return existing.length > 0;
  }

  async function saveContact(userId: string, contactData: any) {
    if (await isDuplicate(userId, contactData)) {
      throw new Error('Contact already saved');
    }

    // Deduzir crédito e salvar
  }
  ```

- [ ] Atualizar endpoint `POST /api/contacts`
- [ ] Retornar erro 409 Conflict se duplicado
- [ ] Frontend: mostrar mensagem "Contato já salvo anteriormente"

#### Opção B: Bulk dedup (Adicional)
- [ ] Script para encontrar duplicatas existentes
- [ ] UI em Settings: "Encontrar duplicatas"
- [ ] Permitir usuário escolher qual manter
- [ ] Opcional: reembolsar créditos de duplicatas

### Indexes para Performance

- [ ] Criar index composto:
  ```sql
  CREATE INDEX idx_contacts_dedup
  ON contacts(user_id, title, phone, address);
  ```

- [ ] Migração

---

## 📊 3. Monitoring e APM

**Estimativa**: 2-3 dias

### Escolher Solução

**Opções**:
- Datadog (pago, completo)
- New Relic (pago, completo)
- Sentry (erros) + Prometheus + Grafana (open source)
- Elastic APM (open source)

**Recomendação**: Sentry (erros) + custom metrics

### Setup Sentry

- [ ] Criar conta Sentry
- [ ] Instalar SDKs
  ```bash
  # Backend
  npm install @sentry/node @sentry/tracing

  # Frontend
  npm install @sentry/react
  ```

- [ ] Configurar backend (`src/index.ts`)
  ```typescript
  import * as Sentry from '@sentry/node';

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1, // 10% das transações
  });

  // Erro handler
  app.use(Sentry.Handlers.errorHandler());
  ```

- [ ] Configurar frontend (`src/main.tsx`)
  ```typescript
  import * as Sentry from '@sentry/react';

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [new Sentry.BrowserTracing()],
    tracesSampleRate: 0.1,
  });
  ```

### Custom Metrics

- [ ] Criar `backend/src/utils/metrics.ts`
  ```typescript
  export const metrics = {
    searchDuration: new Map<string, number>(),
    apifyRequests: 0,
    creditsPurchased: 0,

    recordSearchDuration(duration: number) {
      // ...
    },

    recordApifyRequest() {
      this.apifyRequests++;
    }
  };
  ```

- [ ] Endpoint `/api/metrics` (admin only)
- [ ] Dashboard admin com:
  - Total searches hoje
  - Total créditos comprados hoje
  - Tempo médio de resposta Apify
  - Taxa de erro

### Alertas

- [ ] Configurar alertas Sentry:
  - Erro rate > 5% em 5 minutos
  - P95 latency > 5 segundos
  - Apify failures > 10% em 10 minutos

- [ ] Notificações via Slack/Email

### Health Checks

- [ ] Endpoint `/health`
  ```typescript
  app.get('/health', async (req, res) => {
    const checks = {
      database: await checkDatabase(),
      apify: await checkApify(),
      stripe: await checkStripe()
    };

    const healthy = Object.values(checks).every(c => c.ok);

    res.status(healthy ? 200 : 503).json(checks);
  });
  ```

- [ ] Monitorar com uptime service (UptimeRobot, Pingdom)

---

## 💰 4. Sistema de Billing Avançado

**Estimativa**: 5-7 dias

### Integrar Arquivos Existentes

Você já tem vários arquivos criados mas não integrados:

#### Subscriptions

- [ ] Revisar `backend/src/routes/subscriptions.ts`
- [ ] Criar tabela `subscriptions`
  ```typescript
  {
    id: uuid;
    userId: uuid;
    planId: uuid; // FK to subscription_plans
    status: 'active' | 'canceled' | 'past_due';
    currentPeriodStart: timestamp;
    currentPeriodEnd: timestamp;
    cancelAtPeriodEnd: boolean;
    stripeSubscriptionId: string;
    createdAt: timestamp;
    updatedAt: timestamp;
  }
  ```

- [ ] Criar tabela `subscription_plans`
  ```typescript
  {
    id: uuid;
    name: string; // "Pro", "Enterprise"
    creditsPerMonth: number;
    price: decimal;
    stripePriceId: string;
    isActive: boolean;
  }
  ```

- [ ] Migração
- [ ] Seed plans (script já existe: `seed-subscription-plans.ts`)
- [ ] Integrar routes no `index.ts`

#### Auto Top-Up

- [ ] Revisar `backend/src/services/autoTopUp.ts`
- [ ] Adicionar campos em `users`:
  ```typescript
  {
    autoTopUpEnabled: boolean;
    autoTopUpThreshold: number; // Quando balance < X
    autoTopUpAmount: number; // Comprar Y créditos
    autoTopUpPackageId: uuid; // FK to credit_packages
  }
  ```

- [ ] Migração
- [ ] UI em Settings para configurar
- [ ] Trigger: ao deduzir créditos, verificar threshold
- [ ] Executar purchase automaticamente via Stripe

#### Billing Alerts

- [ ] Revisar `backend/src/services/billingAlerts.ts`
- [ ] Enviar email quando:
  - Balance < 10
  - Balance = 0
  - Subscription renewal failed
  - Auto top-up failed

#### Spending Cap

- [ ] Revisar `backend/src/services/spendingCap.ts`
- [ ] Adicionar em `users`:
  ```typescript
  {
    spendingCapEnabled: boolean;
    spendingCapAmount: number; // Máximo $ por mês
    spendingCapPeriodStart: timestamp;
  }
  ```

- [ ] Migração
- [ ] Bloquear purchases se cap atingido
- [ ] UI em Settings
- [ ] Alert quando próximo do cap (90%)

#### Billing Cycle Reports

- [ ] Revisar `backend/src/services/billingCycle.ts`
- [ ] Criar tabela `billing_cycles`
  ```typescript
  {
    id: uuid;
    userId: uuid;
    periodStart: timestamp;
    periodEnd: timestamp;
    creditsUsed: number;
    creditsPurchased: number;
    totalSpent: decimal;
    searches: number;
    contactsSaved: number;
  }
  ```

- [ ] Cron job mensal: gerar report
- [ ] Enviar email com resumo
- [ ] UI: histórico de billing cycles

---

## 🔒 5. Audit Logging

**Estimativa**: 2 dias

### Criar Tabela de Audit

- [ ] Schema `audit_logs`
  ```typescript
  {
    id: uuid;
    userId?: uuid; // Null se ação de sistema
    action: string; // 'user.created', 'credits.purchased', 'settings.updated'
    resourceType: string; // 'user', 'contact', 'settings'
    resourceId?: string;
    changes?: jsonb; // {old: {...}, new: {...}}
    ipAddress?: string;
    userAgent?: string;
    createdAt: timestamp;
  }
  ```

- [ ] Migração

### Implementar Service

- [ ] Criar `backend/src/services/auditLog.ts`
  ```typescript
  export async function logAction(params: {
    userId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    changes?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    await db.insert(auditLogs).values({
      ...params,
      createdAt: new Date()
    });
  }
  ```

### Integrar em Ações Críticas

- [ ] Admin: alteração de créditos de usuários
- [ ] Admin: mudança de role (user → admin)
- [ ] Admin: atualização de settings
- [ ] Admin: criação/edição de packages
- [ ] User: exclusão de conta
- [ ] User: mudança de email (se implementado)

### UI de Audit (Admin)

- [ ] Página `/admin/audit-logs`
- [ ] Filtros:
  - Por usuário
  - Por ação
  - Por data
- [ ] Exportar logs (CSV)

---

## 🚀 6. User-Level API Rate Limiting

**Estimativa**: 1-2 dias

### Implementar Rate Limit por Usuário

Atualmente só há rate limit global (IP).

- [ ] Instalar `express-rate-limit` stores
  ```bash
  npm install rate-limit-redis
  ```

- [ ] Configurar Redis (opcional, ou usar in-memory)

- [ ] Criar rate limiters específicos:
  ```typescript
  import rateLimit from 'express-rate-limit';

  // Busca: 10 por hora por usuário
  export const searchRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.user?.id || req.ip,
    message: 'Too many searches. Limit: 10 per hour.'
  });

  // Salvar contato: 100 por hora
  export const contactSaveRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100,
    keyGenerator: (req) => req.user?.id || req.ip
  });

  // Purchase: 5 por dia (prevenir fraude)
  export const purchaseRateLimit = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.user?.id || req.ip
  });
  ```

- [ ] Aplicar nos endpoints:
  ```typescript
  router.post('/search', requireAuth, searchRateLimit, searchHandler);
  router.post('/contacts', requireAuth, contactSaveRateLimit, saveContactHandler);
  router.post('/credits/purchase', requireAuth, purchaseRateLimit, purchaseHandler);
  ```

### Admin Override

- [ ] Admins não têm rate limit
- [ ] Usuários premium podem ter limites maiores (future)

### Exibir Limites no Frontend

- [ ] Headers de resposta:
  ```
  X-RateLimit-Limit: 10
  X-RateLimit-Remaining: 7
  X-RateLimit-Reset: 1234567890
  ```

- [ ] UI: mostrar "X searches restantes nesta hora"

---

## 🎨 7. UX Improvements

**Estimativa**: 3-4 dias

### Preview de Custos

- [ ] Antes de iniciar busca:
  ```
  Esta busca custará:
  - 1 crédito para executar
  - ~1 crédito por contato salvo (estimado: 20 contatos)

  Total estimado: 1-21 créditos
  Seu balance: 50 créditos
  ```

- [ ] Modal de confirmação se custo estimado > 10 créditos

### Dashboard de Gastos

- [ ] Card: "Gastos este mês"
  - Total créditos usados
  - Total $ gasto
  - Breakdown: X% em buscas, Y% em contatos

- [ ] Gráfico de uso (últimos 7 dias)

- [ ] Top searches (mais resultados salvos)

### Onboarding Melhorado

- [ ] Tour guiado no primeiro acesso (react-joyride)
- [ ] Checklist de primeiros passos:
  - [ ] Executar primeira busca
  - [ ] Salvar primeiro contato
  - [ ] Exportar contatos
  - [ ] Comprar créditos

### Contact List UX

- [ ] Bulk actions:
  - Selecionar múltiplos
  - Deletar selecionados
  - Exportar selecionados
  - Marcar como favoritos

- [ ] Filtros:
  - Por search
  - Por rating
  - Por categoria
  - Favoritos only

- [ ] Sorting:
  - Nome (A-Z)
  - Rating (maior primeiro)
  - Data adicionado (recente)

---

## ✅ Checklist de Conclusão

Antes de passar para longo prazo:

- [ ] ✅ Emails sendo enviados em todos eventos críticos
- [ ] ✅ Deduplicação impedindo cobranças desnecessárias
- [ ] ✅ Sentry capturando 100% dos erros
- [ ] ✅ Health checks configurados e monitorados
- [ ] ✅ Billing avançado (subscriptions, auto top-up) funcionando
- [ ] ✅ Audit log registrando ações admin
- [ ] ✅ Rate limiting por usuário ativo
- [ ] ✅ UX melhorada com preview de custos e dashboards

---

**Anterior**: [01-curto-prazo.md](01-curto-prazo.md)
**Próximo**: [03-longo-prazo.md](03-longo-prazo.md)
