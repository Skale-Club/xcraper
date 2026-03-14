# Métricas e Analytics

KPIs essenciais para medir sucesso do produto e tomar decisões baseadas em dados.

## 📊 1. Métricas de Negócio

### Revenue Metrics

**MRR (Monthly Recurring Revenue)**
```typescript
SELECT
  DATE_TRUNC('month', current_period_start) as month,
  SUM(sp.price) as mrr
FROM subscriptions s
JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE s.status = 'active'
GROUP BY month
ORDER BY month DESC;
```

**ARR (Annual Recurring Revenue)**
- ARR = MRR × 12

**ARPU (Average Revenue Per User)**
```typescript
SELECT
  SUM(amount) / COUNT(DISTINCT user_id) as arpu
FROM credit_transactions
WHERE type = 'purchase'
  AND created_at >= NOW() - INTERVAL '30 days';
```

**LTV (Lifetime Value)**
```typescript
// Simplified LTV = ARPU × Average Customer Lifetime (months)
const avgLifetime = 12; // meses (calcular real depois)
const ltv = arpu * avgLifetime;
```

**CAC (Customer Acquisition Cost)**
```typescript
// Total marketing spend / New customers
const cac = monthlyMarketingSpend / newCustomers;

// Target: LTV/CAC ratio > 3
```

### Growth Metrics

**New Signups (MoM Growth)**
```typescript
SELECT
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as signups,
  LAG(COUNT(*)) OVER (ORDER BY DATE_TRUNC('month', created_at)) as prev_month,
  ROUND(
    (COUNT(*) - LAG(COUNT(*)) OVER (ORDER BY DATE_TRUNC('month', created_at))) * 100.0 /
    LAG(COUNT(*)) OVER (ORDER BY DATE_TRUNC('month', created_at)),
    2
  ) as growth_percent
FROM users
GROUP BY month
ORDER BY month DESC;
```

**Activation Rate**
```typescript
// % de usuários que fizeram primeira busca
SELECT
  COUNT(DISTINCT user_id) FILTER (WHERE searches > 0) * 100.0 /
  COUNT(DISTINCT id) as activation_rate
FROM users;
```

**Conversion Rate (Free → Paid)**
```typescript
SELECT
  COUNT(DISTINCT user_id) FILTER (WHERE total_spent > 0) * 100.0 /
  COUNT(*) as conversion_rate
FROM users;
```

### Retention & Churn

**Monthly Active Users (MAU)**
```typescript
SELECT COUNT(DISTINCT user_id)
FROM search_history
WHERE created_at >= NOW() - INTERVAL '30 days';
```

**Weekly Active Users (WAU)**
```typescript
SELECT COUNT(DISTINCT user_id)
FROM search_history
WHERE created_at >= NOW() - INTERVAL '7 days';
```

**DAU/MAU Ratio** (Stickiness)
```typescript
// Target: > 20% é bom
const stickiness = (dau / mau) * 100;
```

**Churn Rate**
```typescript
// Subscriptions canceladas / Total subscriptions ativas
SELECT
  COUNT(*) FILTER (WHERE status = 'canceled' AND canceled_at >= NOW() - INTERVAL '30 days') * 100.0 /
  COUNT(*) FILTER (WHERE status = 'active' OR status = 'canceled')
  as monthly_churn_rate
FROM subscriptions;
```

**Retention Cohorts**
```typescript
// % de usuários que voltam após N dias
SELECT
  DATE_TRUNC('month', u.created_at) as cohort_month,
  COUNT(DISTINCT u.id) as cohort_size,
  COUNT(DISTINCT s.user_id) FILTER (WHERE s.created_at > u.created_at + INTERVAL '30 days') as retained_month_1,
  COUNT(DISTINCT s.user_id) FILTER (WHERE s.created_at > u.created_at + INTERVAL '60 days') as retained_month_2
FROM users u
LEFT JOIN search_history s ON u.id = s.user_id
GROUP BY cohort_month
ORDER BY cohort_month DESC;
```

---

## 🎯 2. Métricas de Produto

### Engagement

**Searches per User**
```typescript
SELECT
  AVG(search_count) as avg_searches_per_user
FROM (
  SELECT user_id, COUNT(*) as search_count
  FROM search_history
  WHERE created_at >= NOW() - INTERVAL '30 days'
  GROUP BY user_id
) subquery;
```

**Contacts Saved per User**
```typescript
SELECT
  AVG(contact_count) as avg_contacts_per_user
FROM (
  SELECT user_id, COUNT(*) as contact_count
  FROM contacts
  WHERE created_at >= NOW() - INTERVAL '30 days'
  GROUP BY user_id
) subquery;
```

**Save Rate**
```typescript
// Contatos salvos / Total de resultados
SELECT
  COUNT(DISTINCT c.id) * 100.0 /
  SUM(sh.total_results) as save_rate
FROM search_history sh
LEFT JOIN contacts c ON sh.id = c.search_id
WHERE sh.created_at >= NOW() - INTERVAL '30 days';
```

**Export Rate**
```typescript
// % de usuários que exportam contatos
SELECT
  COUNT(DISTINCT user_id) * 100.0 /
  (SELECT COUNT(*) FROM users WHERE created_at < NOW() - INTERVAL '7 days')
  as export_rate
FROM contacts
WHERE created_at >= NOW() - INTERVAL '30 days';
```

### Performance

**Search Success Rate**
```typescript
SELECT
  COUNT(*) FILTER (WHERE status = 'completed') * 100.0 /
  COUNT(*) as success_rate
FROM search_history
WHERE created_at >= NOW() - INTERVAL '7 days';
```

**Average Search Duration**
```typescript
SELECT
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_seconds
FROM search_history
WHERE status = 'completed'
  AND created_at >= NOW() - INTERVAL '7 days';
```

**Top Queries**
```typescript
SELECT
  query,
  location,
  COUNT(*) as search_count,
  AVG(total_results) as avg_results
FROM search_history
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY query, location
ORDER BY search_count DESC
LIMIT 20;
```

**Top Categories**
```typescript
SELECT
  category,
  COUNT(*) as contact_count
FROM contacts
WHERE category IS NOT NULL
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY category
ORDER BY contact_count DESC
LIMIT 20;
```

---

## 💰 3. Métricas de Monetização

### Credits

**Total Credits in Circulation**
```typescript
SELECT SUM(credits) as total_credits
FROM users
WHERE is_active = true;
```

**Credits Burn Rate**
```typescript
// Créditos usados por dia
SELECT
  DATE(created_at) as date,
  SUM(ABS(amount)) as credits_used
FROM credit_transactions
WHERE type = 'usage'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY date
ORDER BY date DESC;
```

**Credits Purchase Rate**
```typescript
// Créditos comprados por dia
SELECT
  DATE(created_at) as date,
  SUM(amount) as credits_purchased,
  COUNT(DISTINCT user_id) as unique_purchasers
FROM credit_transactions
WHERE type = 'purchase'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY date
ORDER BY date DESC;
```

**Average Credit Package Size**
```typescript
SELECT
  AVG(cp.credits) as avg_package_size
FROM credit_transactions ct
JOIN credit_packages cp ON ct.metadata->>'packageId' = cp.id
WHERE ct.type = 'purchase'
  AND ct.created_at >= NOW() - INTERVAL '30 days';
```

### Pricing

**Revenue by Package**
```typescript
SELECT
  cp.name,
  COUNT(*) as purchases,
  SUM(cp.price) as total_revenue
FROM credit_transactions ct
JOIN credit_packages cp ON ct.metadata->>'packageId' = cp.id
WHERE ct.type = 'purchase'
  AND ct.created_at >= NOW() - INTERVAL '30 days'
GROUP BY cp.name, cp.price
ORDER BY total_revenue DESC;
```

**Revenue by Subscription Plan**
```typescript
SELECT
  sp.name,
  COUNT(s.id) as active_subs,
  SUM(sp.price) as mrr
FROM subscriptions s
JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE s.status = 'active'
GROUP BY sp.name, sp.price
ORDER BY mrr DESC;
```

---

## 👥 4. Métricas de Usuário

### Segmentation

**Users by Credit Balance**
```typescript
SELECT
  CASE
    WHEN credits = 0 THEN '0'
    WHEN credits BETWEEN 1 AND 10 THEN '1-10'
    WHEN credits BETWEEN 11 AND 50 THEN '11-50'
    WHEN credits BETWEEN 51 AND 100 THEN '51-100'
    WHEN credits > 100 THEN '100+'
  END as credit_range,
  COUNT(*) as user_count
FROM users
WHERE is_active = true
GROUP BY credit_range
ORDER BY MIN(credits);
```

**Power Users** (Top 10% by usage)
```typescript
SELECT
  u.id,
  u.email,
  COUNT(sh.id) as total_searches,
  COUNT(c.id) as total_contacts,
  u.credits
FROM users u
LEFT JOIN search_history sh ON u.id = sh.user_id
LEFT JOIN contacts c ON u.id = c.user_id
GROUP BY u.id
ORDER BY total_searches DESC
LIMIT (SELECT COUNT(*) * 0.1 FROM users)::integer;
```

**Dormant Users** (Não usam há 30+ dias)
```typescript
SELECT
  u.id,
  u.email,
  MAX(sh.created_at) as last_search
FROM users u
LEFT JOIN search_history sh ON u.id = sh.user_id
WHERE u.created_at < NOW() - INTERVAL '30 days'
GROUP BY u.id
HAVING MAX(sh.created_at) < NOW() - INTERVAL '30 days'
  OR MAX(sh.created_at) IS NULL;
```

---

## 📈 5. Dashboards

### Admin Dashboard KPIs

- [ ] **Today's Stats**
  - New signups
  - Total searches
  - Total contacts saved
  - Revenue

- [ ] **This Month**
  - MRR
  - New customers
  - Churn rate
  - Active subscriptions

- [ ] **Charts**
  - Revenue trend (last 12 months)
  - Signups trend (last 6 months)
  - Credits usage vs purchase
  - Top queries (word cloud)

### User Dashboard KPIs

- [ ] **My Usage**
  - Searches this month
  - Contacts saved this month
  - Credits used vs remaining
  - Top search queries

- [ ] **Charts**
  - Usage over time (last 30 days)
  - Contacts by category (pie chart)
  - Search success rate

---

## 🎨 6. Analytics Tools Integration

### Google Analytics 4

- [ ] Configurar GA4
  ```typescript
  // frontend/src/lib/analytics.ts
  import ReactGA from 'react-ga4';

  ReactGA.initialize(import.meta.env.VITE_GA_MEASUREMENT_ID);

  export const analytics = {
    pageView: (path: string) => {
      ReactGA.send({ hitType: 'pageview', page: path });
    },

    event: (category: string, action: string, label?: string) => {
      ReactGA.event({ category, action, label });
    }
  };
  ```

- [ ] Track eventos importantes:
  ```typescript
  // Search executed
  analytics.event('Search', 'Execute', query);

  // Contact saved
  analytics.event('Contact', 'Save', category);

  // Credits purchased
  analytics.event('Purchase', 'Credits', packageName);
  ```

### Mixpanel (Alternativa)

Mais focado em product analytics.

- [ ] Setup Mixpanel
- [ ] Track user journey completo
- [ ] Funnels:
  - Landing → Signup → First Search → First Contact → Purchase
- [ ] Cohorts automáticos
- [ ] A/B testing built-in

### Amplitude (Alternativa)

Similar ao Mixpanel, excelente para product analytics.

---

## 📊 7. Reporting Automatizado

### Daily Report (Email para founders)

- [ ] Cron job diário (8am)
- [ ] Conteúdo:
  ```
  📊 Daily Report - Jan 15, 2024

  💰 Revenue
  - Today: $450 (+12% vs yesterday)
  - MTD: $8,200 (+18% vs last month)

  👥 Users
  - New signups: 15
  - Active users: 234
  - Churn: 2 subscriptions canceled

  🔍 Searches
  - Total: 567
  - Success rate: 94.2%
  - Top query: "pizza restaurants"

  💳 Credits
  - Purchased: 5,000
  - Used: 4,200
  - Balance in system: 125,000

  🚨 Alerts
  - No critical issues
  ```

### Weekly Report

- [ ] Tendências vs semana anterior
- [ ] Cohort analysis
- [ ] Feature adoption
- [ ] Customer feedback summary

### Monthly Business Review

- [ ] MRR growth
- [ ] CAC vs LTV
- [ ] Churn analysis
- [ ] Product roadmap alignment

---

## 🎯 8. Experiment Tracking (A/B Tests)

### Framework

- [ ] Escolher ferramenta: Optimizely, LaunchDarkly, ou custom
- [ ] Implementar feature flags
  ```typescript
  import { useFeatureFlag } from './hooks/useFeatureFlag';

  function PricingPage() {
    const newPricing = useFeatureFlag('new-pricing-test');

    return newPricing ? <NewPricingCards /> : <OldPricingCards />;
  }
  ```

### Experiments para Rodar

**Pricing**
- [ ] Testar diferentes preços de packages
- [ ] Mostrar "Most Popular" badge
- [ ] Annual discount (save 20%)

**Onboarding**
- [ ] Welcome tutorial vs no tutorial
- [ ] Free credits: 10 vs 25 vs 50
- [ ] Require onboarding completion

**Features**
- [ ] Auto top-up opt-in by default
- [ ] Email notifications on/off by default
- [ ] Dashboard layout variants

### Metrics per Experiment

- [ ] Conversion rate (primary metric)
- [ ] Retention rate
- [ ] Average revenue
- [ ] Statistical significance (p < 0.05)

---

## ✅ Checklist de Analytics

- [ ] ✅ Google Analytics 4 implementado
- [ ] ✅ Eventos críticos sendo tracked
- [ ] ✅ Admin dashboard com KPIs principais
- [ ] ✅ User dashboard com stats pessoais
- [ ] ✅ Queries SQL para todas métricas documentadas
- [ ] ✅ Daily report automatizado
- [ ] ✅ Framework de A/B testing pronto
- [ ] ✅ Cohort analysis rodando mensalmente

---

**Anterior**: [08-arquitetura.md](08-arquitetura.md)
**Próximo**: [10-oportunidades-receita.md](10-oportunidades-receita.md)
