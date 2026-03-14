# Sistema de Billing Avançado

Integração completa dos arquivos de billing já criados mas não integrados.

## 📦 Arquivos Existentes

Você já criou vários arquivos relacionados a billing que precisam ser integrados:

```
backend/src/routes/adminBilling.ts
backend/src/routes/subscriptions.ts
backend/src/services/autoTopUp.ts
backend/src/services/billingAlerts.ts
backend/src/services/billingCycle.ts
backend/src/services/creditRules.ts
backend/src/services/reporting.ts
backend/src/services/spendingCap.ts
backend/src/scripts/seed-subscription-plans.ts
```

## 🔄 1. Subscriptions (Modelo Recorrente)

**Estimativa**: 5-7 dias

### Database Schema

- [ ] Criar tabela `subscription_plans`
  ```typescript
  {
    id: uuid;
    name: string; // "Starter", "Pro", "Enterprise"
    description: string;
    creditsPerMonth: number; // Créditos incluídos
    price: decimal; // Preço mensal USD
    billingPeriod: 'monthly' | 'yearly';
    stripePriceId: string; // Stripe Price ID
    features: jsonb; // ["Advanced filters", "Priority support"]
    isActive: boolean;
    sortOrder: number;
    createdAt: timestamp;
    updatedAt: timestamp;
  }
  ```

- [ ] Criar tabela `subscriptions`
  ```typescript
  {
    id: uuid;
    userId: uuid; // ou workspaceId se implementar teams
    planId: uuid; // FK to subscription_plans
    status: 'active' | 'past_due' | 'canceled' | 'paused';
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    currentPeriodStart: timestamp;
    currentPeriodEnd: timestamp;
    cancelAtPeriodEnd: boolean;
    canceledAt?: timestamp;
    createdAt: timestamp;
    updatedAt: timestamp;
  }
  ```

- [ ] Migração
- [ ] Indexes em `userId`, `status`, `stripeSubscriptionId`

### Stripe Integration

- [ ] Criar produtos no Stripe Dashboard:
  - Starter: $29/mo - 100 créditos/mês
  - Professional: $99/mo - 500 créditos/mês
  - Business: $299/mo - 2000 créditos/mês
  - Enterprise: $999/mo - 10000 créditos/mês

- [ ] Copiar Price IDs para seed script

### Backend Routes (`/api/subscriptions`)

- [ ] `GET /api/subscriptions/plans` - Listar planos disponíveis
- [ ] `POST /api/subscriptions/create` - Criar subscription
  ```typescript
  {
    planId: uuid;
    paymentMethodId: string; // Stripe payment method
  }
  ```

- [ ] `GET /api/subscriptions/current` - Subscription ativa do usuário
- [ ] `POST /api/subscriptions/cancel` - Cancelar (no fim do período)
- [ ] `POST /api/subscriptions/resume` - Reverter cancelamento
- [ ] `POST /api/subscriptions/update` - Trocar plano
- [ ] `GET /api/subscriptions/invoices` - Histórico de faturas

### Billing Cycle Logic

- [ ] No início de cada ciclo (Stripe webhook `invoice.payment_succeeded`):
  1. Adicionar `creditsPerMonth` ao balance
  2. Criar transaction record (type: 'subscription_renewal')
  3. Atualizar `currentPeriodStart` e `currentPeriodEnd`

- [ ] Se pagamento falhar (`invoice.payment_failed`):
  1. Atualizar status → 'past_due'
  2. Enviar email alertando
  3. Retry automático (Stripe faz isso)
  4. Se falhar 3x: cancelar subscription

### Frontend

- [ ] Página `/pricing` - Mostrar planos
  - Cards com features
  - Botão "Subscribe"
  - Toggle monthly/yearly (se oferecer desconto anual)

- [ ] Página `/subscription` - Gerenciar subscription
  - Plano atual
  - Próxima cobrança
  - Botão "Change Plan"
  - Botão "Cancel Subscription"
  - Histórico de invoices

- [ ] Modal de confirmação ao cancelar
- [ ] Feedback visual ao trocar plano (downgrade vs upgrade)

### Rollover vs Fresh

**Opção A: Fresh credits** (Recomendado)
- A cada ciclo, resetar balance para `creditsPerMonth`
- Simples, usuário entende fácil

**Opção B: Rollover**
- Credits não usados acumulam
- Máximo de rollover: 2x o plano (ex: Pro 500/mês, max 1000)
- Mais generoso, mas complexo

- [ ] Escolher estratégia e implementar

---

## ⚡ 2. Auto Top-Up

**Estimativa**: 2-3 dias

### Database Schema

- [ ] Adicionar campos em `users` (ou `workspaces`):
  ```typescript
  {
    autoTopUpEnabled: boolean;
    autoTopUpThreshold: number; // Quando balance < X
    autoTopUpPackageId: uuid; // FK to credit_packages
    autoTopUpPaymentMethodId: string; // Stripe payment method ID
  }
  ```

- [ ] Migração

### Logic

- [ ] Service `autoTopUp.ts`:
  ```typescript
  export async function checkAndExecuteAutoTopUp(userId: string) {
    const user = await getUser(userId);

    if (!user.autoTopUpEnabled) return;
    if (user.credits >= user.autoTopUpThreshold) return;

    const package = await getCreditPackage(user.autoTopUpPackageId);

    try {
      // Criar payment intent no Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount: package.price * 100, // cents
        currency: 'usd',
        customer: user.stripeCustomerId,
        payment_method: user.autoTopUpPaymentMethodId,
        confirm: true,
        off_session: true // Cobrar sem usuário presente
      });

      // Adicionar créditos
      await addCredits(userId, package.credits, 'auto_top_up');

      // Notificar por email
      await sendEmail({
        to: user.email,
        subject: 'Auto Top-Up Successful',
        template: 'auto-top-up-success',
        data: { credits: package.credits, price: package.price }
      });

    } catch (error) {
      // Falha (ex: cartão expirado)
      await sendEmail({
        to: user.email,
        subject: 'Auto Top-Up Failed',
        template: 'auto-top-up-failed',
        data: { error: error.message }
      });

      // Desabilitar auto top-up para evitar tentativas repetidas
      await disableAutoTopUp(userId);
    }
  }
  ```

- [ ] Chamar `checkAndExecuteAutoTopUp` após deduzir créditos:
  ```typescript
  // Em deductCredits service
  const newBalance = await deductCredits(userId, amount, description);

  // Check auto top-up
  await checkAndExecuteAutoTopUp(userId);
  ```

### Frontend

- [ ] UI em Settings → Billing:
  ```tsx
  <Card>
    <h3>Auto Top-Up</h3>
    <p>Automatically purchase credits when your balance is low</p>

    <Switch
      checked={autoTopUpEnabled}
      onChange={handleToggle}
    />

    {autoTopUpEnabled && (
      <>
        <Select
          label="When balance falls below"
          options={[10, 25, 50, 100]}
          value={autoTopUpThreshold}
        />

        <Select
          label="Purchase package"
          options={creditPackages}
          value={autoTopUpPackageId}
        />

        <PaymentMethodSelector
          value={autoTopUpPaymentMethodId}
          onChange={...}
        />

        <Button>Save Auto Top-Up Settings</Button>
      </>
    )}
  </Card>
  ```

### Email Templates

- [ ] Template: Auto top-up success
- [ ] Template: Auto top-up failed
- [ ] Template: Auto top-up disabled (após falha)

---

## 🚨 3. Billing Alerts

**Estimativa**: 1-2 dias

### Service `billingAlerts.ts`

- [ ] Implementar alertas:
  ```typescript
  export async function checkBillingAlerts(userId: string) {
    const user = await getUser(userId);

    // Low credits warning (10 créditos)
    if (user.credits === 10 && !user.autoTopUpEnabled) {
      await sendEmail({
        to: user.email,
        subject: 'Low Credits Warning',
        template: 'low-credits-warning'
      });
    }

    // Out of credits
    if (user.credits === 0) {
      await sendEmail({
        to: user.email,
        subject: 'Out of Credits',
        template: 'out-of-credits'
      });
    }

    // Subscription renewal failed
    const sub = await getActiveSubscription(userId);
    if (sub?.status === 'past_due') {
      await sendEmail({
        to: user.email,
        subject: 'Subscription Payment Failed',
        template: 'subscription-payment-failed',
        data: { nextRetry: sub.nextRetryDate }
      });
    }
  }
  ```

- [ ] Chamar após dedução de créditos
- [ ] Chamar em webhook Stripe (payment failed)

### Alert Preferences

- [ ] Permitir usuário customizar:
  - Threshold de "low credits" (default 10)
  - Desabilitar certos alerts

- [ ] Tabela `billing_alert_preferences`
  ```typescript
  {
    userId: uuid;
    lowCreditsThreshold: number;
    alertLowCredits: boolean;
    alertOutOfCredits: boolean;
    alertPaymentFailed: boolean;
  }
  ```

---

## 💰 4. Spending Cap

**Estimativa**: 2-3 dias

### Database Schema

- [ ] Adicionar em `users` (ou `workspaces`):
  ```typescript
  {
    spendingCapEnabled: boolean;
    spendingCapAmount: number; // Máximo $ por mês
    spendingCapPeriodStart: timestamp; // Início do mês atual
    spendingCapCurrentSpend: number; // Gasto acumulado este mês
  }
  ```

- [ ] Migração

### Logic

- [ ] Service `spendingCap.ts`:
  ```typescript
  export async function checkSpendingCap(userId: string, amount: number): Promise<boolean> {
    const user = await getUser(userId);

    if (!user.spendingCapEnabled) return true; // Sem limite

    // Reset mensal
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    if (user.spendingCapPeriodStart < monthStart) {
      // Novo mês, resetar
      await db.update(users)
        .set({
          spendingCapPeriodStart: monthStart,
          spendingCapCurrentSpend: 0
        })
        .where(eq(users.id, userId));

      user.spendingCapCurrentSpend = 0;
    }

    // Verificar se nova compra ultrapassa cap
    const newSpend = user.spendingCapCurrentSpend + amount;

    if (newSpend > user.spendingCapAmount) {
      // Alert usuário
      await sendEmail({
        to: user.email,
        subject: 'Spending Cap Reached',
        template: 'spending-cap-reached',
        data: {
          cap: user.spendingCapAmount,
          current: user.spendingCapCurrentSpend
        }
      });

      return false; // Bloquear compra
    }

    return true; // Permitir
  }

  export async function recordSpend(userId: string, amount: number) {
    await db.update(users)
      .set({
        spendingCapCurrentSpend: sql`${users.spendingCapCurrentSpend} + ${amount}`
      })
      .where(eq(users.id, userId));
  }
  ```

- [ ] Integrar em `POST /api/credits/purchase`:
  ```typescript
  const canPurchase = await checkSpendingCap(userId, package.price);
  if (!canPurchase) {
    return res.status(403).json({
      error: 'Spending cap reached',
      message: 'You have reached your monthly spending limit'
    });
  }

  // ... processar compra

  await recordSpend(userId, package.price);
  ```

### Alert Preventivo

- [ ] Quando atingir 80% do cap:
  ```typescript
  if (newSpend >= user.spendingCapAmount * 0.8) {
    await sendEmail({
      to: user.email,
      subject: 'Approaching Spending Cap',
      template: 'spending-cap-warning',
      data: {
        percent: (newSpend / user.spendingCapAmount) * 100
      }
    });
  }
  ```

### Frontend

- [ ] UI em Settings → Billing:
  ```tsx
  <Card>
    <h3>Spending Cap</h3>
    <p>Set a maximum monthly spending limit</p>

    <Switch checked={spendingCapEnabled} />

    {spendingCapEnabled && (
      <>
        <Input
          type="number"
          label="Monthly limit ($)"
          value={spendingCapAmount}
        />

        <ProgressBar
          value={spendingCapCurrentSpend}
          max={spendingCapAmount}
          label={`$${spendingCapCurrentSpend} / $${spendingCapAmount}`}
        />
      </>
    )}
  </Card>
  ```

---

## 📊 5. Billing Reports

**Estimativa**: 3-4 dias

### Database Schema

- [ ] Tabela `billing_cycles`
  ```typescript
  {
    id: uuid;
    userId: uuid; // ou workspaceId
    periodStart: timestamp;
    periodEnd: timestamp;
    creditsStartBalance: number;
    creditsAdded: number;
    creditsUsed: number;
    creditsEndBalance: number;
    totalSpent: decimal;
    searchesCount: number;
    contactsSavedCount: number;
    breakdown: jsonb; // Detalhes adicionais
    createdAt: timestamp;
  }
  ```

- [ ] Migração

### Geração de Reports

- [ ] Cron job mensal:
  ```typescript
  // Rodar todo dia 1 às 00:00
  cron.schedule('0 0 1 * *', async () => {
    const users = await getAllActiveUsers();

    for (const user of users) {
      const report = await generateBillingReport(user.id);
      await saveBillingCycle(report);
      await sendBillingReportEmail(user.email, report);
    }
  });

  async function generateBillingReport(userId: string) {
    const lastMonth = getLastMonthRange();

    const transactions = await db.select()
      .from(creditTransactions)
      .where(and(
        eq(creditTransactions.userId, userId),
        gte(creditTransactions.createdAt, lastMonth.start),
        lte(creditTransactions.createdAt, lastMonth.end)
      ));

    const searches = await db.select()
      .from(searchHistory)
      .where(and(
        eq(searchHistory.userId, userId),
        gte(searchHistory.createdAt, lastMonth.start),
        lte(searchHistory.createdAt, lastMonth.end)
      ));

    const contacts = await db.select()
      .from(contacts)
      .where(and(
        eq(contacts.userId, userId),
        gte(contacts.createdAt, lastMonth.start),
        lte(contacts.createdAt, lastMonth.end)
      ));

    const creditsAdded = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const creditsUsed = transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const totalSpent = transactions
      .filter(t => t.type === 'purchase')
      .reduce((sum, t) => sum + (t.metadata?.price || 0), 0);

    return {
      periodStart: lastMonth.start,
      periodEnd: lastMonth.end,
      creditsAdded,
      creditsUsed,
      totalSpent,
      searchesCount: searches.length,
      contactsSavedCount: contacts.length,
      breakdown: {
        searches: searches.length,
        contacts: contacts.length,
        topQueries: getTopQueries(searches),
        topCategories: getTopCategories(contacts)
      }
    };
  }
  ```

### Email Report

- [ ] Template: Monthly billing report
  ```html
  <h2>Your Monthly Usage Report - January 2024</h2>

  <div class="stats">
    <div>Credits Used: 150</div>
    <div>Credits Purchased: 200</div>
    <div>Total Spent: $50.00</div>
  </div>

  <div class="breakdown">
    <p>Searches: 50</p>
    <p>Contacts Saved: 100</p>
  </div>

  <div class="insights">
    <h3>Top Searches</h3>
    <ul>
      <li>Pizza restaurants - 10 searches</li>
      <li>Coffee shops - 8 searches</li>
    </ul>
  </div>

  <a href="https://xcraper.com/billing/report/jan-2024">View Full Report</a>
  ```

### Frontend Report Page

- [ ] Página `/billing/reports`
  - Lista de reports mensais
  - Cards com métricas principais
  - Gráficos de uso (Chart.js)
  - Download PDF

---

## 🎯 6. Credit Rules (Pricing Avançado)

**Estimativa**: 2-3 dias

### Dynamic Pricing

Permitir admins ajustar custos por tipo de ação.

- [ ] Tabela `credit_rules`
  ```typescript
  {
    id: uuid;
    action: string; // 'search', 'contact_save', 'export'
    creditCost: number; // Custo base
    conditions: jsonb; // Regras condicionais
    isActive: boolean;
    createdAt: timestamp;
    updatedAt: timestamp;
  }
  ```

**Exemplo de conditions**:
```json
{
  "search": {
    "base": 1,
    "maxResults": {
      "1-20": 1,
      "21-50": 2,
      "51-100": 3
    }
  },
  "contact_save": {
    "base": 1,
    "premium_fields": {
      "has_email": 0.5,
      "has_phone": 0.5
    }
  }
}
```

- [ ] Service para calcular custo dinâmico:
  ```typescript
  export async function calculateCreditCost(action: string, params: any): Promise<number> {
    const rule = await getCreditRule(action);

    if (!rule) return 1; // Fallback

    let cost = rule.creditCost;

    // Aplicar condições
    if (action === 'search' && params.maxResults) {
      if (params.maxResults > 50) cost = 3;
      else if (params.maxResults > 20) cost = 2;
    }

    return cost;
  }
  ```

- [ ] Admin UI para gerenciar rules

---

## 🏢 7. Admin Billing Dashboard

**Estimativa**: 2-3 dias

### Routes (`/api/admin/billing`)

- [ ] `GET /api/admin/billing/overview` - KPIs globais
  ```typescript
  {
    totalRevenue: number;
    totalRevenueThisMonth: number;
    activeSubscriptions: number;
    totalCreditsSold: number;
    averageRevenuePerUser: number;
  }
  ```

- [ ] `GET /api/admin/billing/transactions` - Todas transações
- [ ] `GET /api/admin/billing/subscriptions` - Todas subscriptions
- [ ] `GET /api/admin/billing/refunds` - Processar reembolsos

### Frontend Admin Page

- [ ] Página `/admin/billing`
  - Cards com métricas principais
  - Gráfico de receita (mensal)
  - Tabela de transações recentes
  - Filtros (data, usuário, tipo)

---

## ✅ Checklist de Billing Avançado

- [ ] ✅ Subscriptions implementadas e testadas
- [ ] ✅ Auto top-up funcionando
- [ ] ✅ Billing alerts enviando emails
- [ ] ✅ Spending cap bloqueando compras
- [ ] ✅ Reports mensais gerados e enviados
- [ ] ✅ Credit rules permitindo pricing flexível
- [ ] ✅ Admin billing dashboard completo
- [ ] ✅ Stripe webhooks 100% implementados
- [ ] ✅ Testes de pagamentos (Stripe test mode)

---

**Anterior**: [06-compliance.md](06-compliance.md)
**Próximo**: [08-arquitetura.md](08-arquitetura.md)
