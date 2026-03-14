# Xcraper Billing System Implementation Plan

## Overview

This document outlines the phased implementation of the comprehensive billing, credits, overage, top-up, and admin management system based on the product specification.

## Current State Summary

### Already Implemented
- Basic credit balance tracking per user
- Subscription plans table with Stripe integration
- Credit transaction ledger
- Stripe checkout for one-time purchases
- Stripe subscription checkout and webhooks
- Auto top-up settings (schema level)
- Rollover credit tracking (schema level)

### Major Gaps
1. No subscription/pricing frontend pages
2. Inconsistent credit package sources
3. No billing management UI for users
4. Auto top-up not triggered automatically
5. Rollover logic not implemented
6. No customer portal route exposed
7. Enrichment credit logic missing
8. Missing admin controls for billing rules

---

## Phase 1: Foundation & Credit Rules (Week 1-2)

### 1.1 Database Schema Enhancements

**Files:** `backend/src/db/schema.ts`

#### New Tables

```typescript
// billing_events - Immutable ledger for all billing events
billing_events: {
  id: uuid (PK)
  userId: string (FK -> users)
  eventType: enum (monthly_grant, consumption, top_up, purchase, refund, adjustment, rollover, expiration)
  creditDelta: integer
  moneyAmount: decimal (nullable)
  currency: string (default 'usd')
  relatedJobId: uuid (nullable, FK -> search_history)
  relatedInvoiceId: string (nullable, Stripe invoice ID)
  stripePaymentIntentId: string (nullable)
  metadata: jsonb
  adminId: string (nullable, if manual action)
  reason: text (nullable)
  createdAt: timestamp
}

// billing_alerts - Track sent alerts to prevent duplicates
billing_alerts: {
  id: uuid (PK)
  userId: string (FK -> users)
  alertType: enum (credits_80, credits_100, topup_success, topup_failed, cap_80, cap_100, renewal_success, renewal_failed, payment_method_expiring)
  sentAt: timestamp
  metadata: jsonb
}

// usage_summary - Daily/period aggregates for reporting
usage_summary: {
  id: uuid (PK)
  userId: string (FK -> users)
  periodStart: date
  periodEnd: date
  standardResults: integer
  enrichedResults: integer
  creditsConsumed: integer
  topUpCredits: integer
  topUpRevenue: decimal
  jobsSubmitted: integer
  jobsFailed: integer
  createdAt: timestamp
}
```

#### Enhance Existing Tables

```typescript
// subscription_plans - Add missing fields
subscription_plans: {
  // ... existing fields ...
  allowAutoTopUp: boolean (default true)
  allowManualPurchase: boolean (default true)
  allowOverage: boolean (default true)
  defaultTopUpCredits: integer (default 250)
  defaultTopUpPrice: decimal (default 5.90)
  defaultTopUpCap: decimal (default 20.00)
  maxTopUpsPerCycle: integer (default 4)
  rolloverPolicy: enum (none, partial, full)
  maxRolloverCredits: integer
  rolloverExpirationDays: integer
  trialEligible: boolean
  displayOrder: integer
  isActive: boolean
  internalCostNotes: text
  customerDisplayText: text
}

// users - Add billing control fields
users: {
  // ... existing fields ...
  monthlyTopUpSpent: decimal (default 0)
  topUpsThisCycle: integer (default 0)
  billingCycleStart: timestamp
  billingCycleEnd: timestamp
  hardUsageStop: boolean (default false)
  capOverride: decimal (nullable)
  accountRiskFlag: enum (none, review, restricted, suspended)
  supportNotes: text
}

// credit_transactions - Add missing fields
credit_transactions: {
  // ... existing fields ...
  stripePaymentIntentId: string
  stripeInvoiceId: string
  moneyAmount: decimal
  currency: string
}
```

### 1.2 Credit Consumption Rules Engine

**Files:** 
- `backend/src/services/creditRules.ts` (new)
- `backend/src/routes/settings.ts` (enhance)

#### Implementation

```typescript
// CreditRulesService
interface CreditConsumptionResult {
  creditsCharged: number;
  breakdown: {
    base: number;
    enrichment: number;
  };
  success: boolean;
  error?: string;
}

class CreditRulesService {
  // Get current pricing rules from settings
  async getPricingRules(): Promise<CreditPricingRules>
  
  // Calculate credits needed for a job
  async estimateCredits(results: ScrapingResult[], requestEnrichment: boolean): Promise<number>
  
  // Consume credits for actual results
  async consumeCredits(
    userId: string, 
    results: ScrapingResult[], 
    jobId: string
  ): Promise<CreditConsumptionResult>
  
  // Handle enrichment pricing (Option A vs Option B)
  async calculateEnrichmentCost(hasEmail: boolean): Promise<number>
  
  // Duplicate detection
  async detectDuplicates(userId: string, placeIds: string[]): Promise<string[]>
}
```

#### Settings to Add
- `creditsPerStandardResult`: 1 (default)
- `creditsPerEnrichedResult`: 3 (default)
- `enrichmentPricingMode`: 'fixed' | 'base_plus_enrichment'
- `chargeDuplicates`: boolean
- `duplicateWindowDays`: integer

### 1.3 Admin Credit Rule Management API

**Files:** `backend/src/routes/settings.ts`

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/credit-rules` | Get current credit pricing rules |
| PATCH | `/api/settings/credit-rules` | Update credit pricing rules |
| POST | `/api/settings/credit-rules/test` | Test rule scenarios |

---

## Phase 2: Subscription & Billing Cycle Management (Week 2-3)

### 2.1 Billing Cycle Service

**Files:** `backend/src/services/billingCycle.ts` (new)

#### Implementation

```typescript
class BillingCycleService {
  // Start new billing cycle
  async startNewCycle(userId: string): Promise<BillingCycleResult>
  
  // Grant monthly credits
  async grantMonthlyCredits(userId: string, planId: string): Promise<void>
  
  // Handle rollover calculation
  async processRollover(userId: string): Promise<number>
  
  // Expire old rollover credits
  async expireRolloverCredits(userId: string): Promise<number>
  
  // Reset cycle counters
  async resetCycleCounters(userId: string): Promise<void>
  
  // Check if cycle should renew
  async checkCycleRenewal(userId: string): Promise<boolean>
}
```

### 2.2 Stripe Webhook Enhancements

**Files:** `backend/src/routes/subscriptions.ts`

#### Enhanced Handlers

```typescript
// invoice.paid - Enhanced
- Grant monthly credits
- Reset usage counters
- Process rollover
- Reset top-up counters
- Send renewal success alert

// invoice.payment_failed - Enhanced
- Mark subscription as past_due
- Block auto top-up
- Send alert
- Log billing event

// customer.subscription.updated
- Handle plan changes
- Prorate credits if needed

// customer.subscription.deleted
- Handle cancellation
- Revoke unused credits (configurable)
- Send cancellation alert
```

### 2.3 Customer Portal Route

**Files:** `backend/src/routes/payments.ts`

#### New Endpoint

```typescript
POST /api/payments/portal
- Creates Stripe customer portal session
- Returns portal URL
- Allows users to manage payment methods, view invoices
```

---

## Phase 3: Auto Top-Up System (Week 3-4)

### 3.1 Auto Top-Up Service

**Files:** `backend/src/services/autoTopUp.ts` (new)

#### Implementation

```typescript
class AutoTopUpService {
  // Check if auto top-up should trigger
  async checkAndTrigger(userId: string): Promise<TopUpResult>
  
  // Execute auto top-up
  async executeTopUp(userId: string): Promise<TopUpResult>
  
  // Validate top-up is allowed
  async validateTopUp(userId: string): Promise<ValidationResult>
  
  // Check spending cap
  async checkCap(userId: string): Promise<CapStatus>
  
  // Record top-up event
  async recordTopUp(userId: string, amount: number, credits: number): Promise<void>
}

interface TopUpResult {
  success: boolean;
  creditsAdded?: number;
  amountCharged?: number;
  error?: string;
  reason?: string;
}
```

### 3.2 Top-Up Trigger Integration

**Files:** `backend/src/routes/search.ts`

#### Integration Points

```typescript
// Before search execution
async function checkCreditsAndTopUp(userId: string, estimatedCredits: number) {
  const balance = await getCreditsBalance(userId);
  
  if (balance < estimatedCredits) {
    if (autoTopUpEnabled(userId)) {
      await autoTopUpService.checkAndTrigger(userId);
    }
  }
  
  // Re-check after potential top-up
  const newBalance = await getCreditsBalance(userId);
  if (newBalance < estimatedCredits) {
    throw new InsufficientCreditsError();
  }
}
```

### 3.3 Top-Up Admin Controls

**Files:** `backend/src/routes/admin/billing.ts` (new)

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/topup/settings` | Get global top-up settings |
| PATCH | `/api/admin/topup/settings` | Update global top-up settings |
| POST | `/api/admin/topup/trigger/:userId` | Manually trigger top-up for user |
| POST | `/api/admin/topup/cancel/:userId` | Cancel pending top-up |
| POST | `/api/admin/topup/refund/:userId` | Refund top-up charge |
| GET | `/api/admin/topup/failures` | List failed top-up attempts |

---

## Phase 4: Manual Credit Purchases (Week 4)

### 4.1 Credit Package Management

**Files:** 
- `backend/src/routes/credits.ts` (enhance)
- `backend/src/db/schema.ts` (enhance)

#### Enhance credit_packages table

```typescript
credit_packages: {
  // ... existing fields ...
  allowedPlanIds: uuid[] (nullable, restrict to plans)
  isPromotional: boolean (default false)
  isHidden: boolean (default false, admin-only packs)
  validFrom: timestamp (nullable)
  validUntil: timestamp (nullable)
  purchaseType: enum ('standard', 'promo', 'compensation', 'admin_only')
}
```

### 4.2 Unified Package API

**Files:** `backend/src/routes/credits.ts`

#### Consolidated Endpoints

```typescript
// Remove hardcoded packages, use DB only
GET /api/credits/packages
- Returns active, visible packages
- Filters by user's plan if restrictions exist
- Includes promotional packs if eligible

POST /api/credits/purchase
- Validates package exists and is active
- Creates Stripe checkout session
- Returns checkout URL
```

### 4.3 Admin Package Management

**Files:** `backend/src/routes/admin/packages.ts` (new)

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/packages` | List all packages (including hidden) |
| POST | `/api/admin/packages` | Create new package |
| PATCH | `/api/admin/packages/:id` | Update package |
| DELETE | `/api/admin/packages/:id` | Deactivate package |
| POST | `/api/admin/packages/:id/duplicate` | Duplicate package |
```

---

## Phase 5: Spending Caps & Protection (Week 4-5)

### 5.1 Cap Management Service

**Files:** `backend/src/services/spendingCap.ts` (new)

#### Implementation

```typescript
class SpendingCapService {
  // Get effective cap for user
  async getEffectiveCap(userId: string): Promise<CapInfo>
  
  // Check if cap allows top-up
  async canTopUp(userId: string, amount: number): Promise<boolean>
  
  // Record spending against cap
  async recordSpending(userId: string, amount: number): Promise<void>
  
  // Get cap status
  async getCapStatus(userId: string): Promise<CapStatus>
  
  // Admin override
  async setCapOverride(userId: string, cap: number): Promise<void>
}

interface CapInfo {
  defaultCap: number;
  userCap: number | null;
  effectiveCap: number;
  spent: number;
  remaining: number;
  percentageUsed: number;
}
```

### 5.2 Cap Enforcement

**Files:** `backend/src/services/autoTopUp.ts`

#### Integration

```typescript
// In autoTopUpService.executeTopUp()
const capStatus = await spendingCapService.getCapStatus(userId);

if (capStatus.remaining < topUpPrice) {
  // Cannot top-up - cap reached
  await alertService.sendCapReachedAlert(userId);
  return { success: false, reason: 'cap_reached' };
}

if (capStatus.percentageUsed >= 80) {
  await alertService.sendCapWarningAlert(userId);
}
```

### 5.3 Admin Cap Controls

**Files:** `backend/src/routes/admin/billing.ts`

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/caps` | List all user caps |
| PATCH | `/api/admin/caps/:userId` | Set user cap override |
| DELETE | `/api/admin/caps/:userId` | Remove override (use default) |
| GET | `/api/admin/caps/at-limit` | Users at cap limit |

---

## Phase 6: Notification System (Week 5)

### 6.1 Billing Alert Service

**Files:** `backend/src/services/billingAlerts.ts` (new)

#### Implementation

```typescript
class BillingAlertService {
  // Credit usage alerts
  async checkCreditAlerts(userId: string): Promise<void>
  
  // Send 80% usage alert
  async sendCredits80Alert(userId: string): Promise<void>
  
  // Send 100% usage alert
  async sendCredits100Alert(userId: string): Promise<void>
  
  // Top-up alerts
  async sendTopUpSuccessAlert(userId: string, credits: number, amount: number): Promise<void>
  async sendTopUpFailedAlert(userId: string, reason: string): Promise<void>
  
  // Cap alerts
  async sendCap80Alert(userId: string): Promise<void>
  async sendCapReachedAlert(userId: string): Promise<void>
  
  // Subscription alerts
  async sendRenewalSuccessAlert(userId: string): Promise<void>
  async sendRenewalFailedAlert(userId: string): Promise<void>
  async sendPaymentMethodExpiringAlert(userId: string): Promise<void>
  
  // Track sent alerts
  async hasSentAlert(userId: string, alertType: string, period: string): Promise<boolean>
}
```

### 6.2 Alert Templates

**Files:** `backend/src/templates/emails/` (new)

#### Email Templates

```
- credits-80-percent.html
- credits-exhausted.html
- topup-success.html
- topup-failed.html
- cap-warning.html
- cap-reached.html
- renewal-success.html
- renewal-failed.html
- payment-method-expiring.html
```

### 6.3 Admin Alert Configuration

**Files:** `backend/src/routes/admin/alerts.ts` (new)

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/alerts/config` | Get alert configurations |
| PATCH | `/api/admin/alerts/config` | Update alert settings |
| POST | `/api/admin/alerts/resend/:userId/:alertType` | Manually resend alert |
| GET | `/api/admin/alerts/history` | View alert history |

---

## Phase 7: Admin Dashboard & Reporting (Week 5-6)

### 7.1 Admin Billing Dashboard

**Files:** 
- `backend/src/routes/admin/reports.ts` (new)
- `frontend/src/pages/AdminBillingPage.tsx` (new)

#### Report Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/reports/overview` | Revenue, MRR, active subs summary |
| GET | `/api/admin/reports/mrr` | MRR trend over time |
| GET | `/api/admin/reports/subscribers` | Active/churned subscriber lists |
| GET | `/api/admin/reports/usage` | Usage by user, plan, period |
| GET | `/api/admin/reports/profitability` | Per-user profitability analysis |
| GET | `/api/admin/reports/topups` | Top-up analytics |
| GET | `/api/admin/reports/failed-payments` | Failed payment tracking |
| GET | `/api/admin/reports/at-risk` | Users hitting caps/exhausting credits |

### 7.2 Profitability Report

**Files:** `backend/src/services/reporting.ts` (new)

#### Implementation

```typescript
interface UserProfitability {
  userId: string;
  email: string;
  planName: string;
  
  // Revenue
  subscriptionRevenue: number;
  topUpRevenue: number;
  totalRevenue: number;
  
  // Usage
  creditsGranted: number;
  creditsConsumed: number;
  standardResults: number;
  enrichedResults: number;
  
  // Costs (estimated)
  apifyCost: number;
  infrastructureCost: number;
  paymentProcessingCost: number;
  totalCost: number;
  
  // Profit
  grossProfit: number;
  marginPercent: number;
  
  // Flags
  isProfitable: boolean;
  riskFlag: string;
}
```

### 7.3 Admin User Billing Control

**Files:** 
- `backend/src/routes/admin/users.ts` (enhance)
- `frontend/src/pages/AdminUserBillingPage.tsx` (new)

#### Enhanced Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users/:userId/billing` | Full billing overview |
| POST | `/api/admin/users/:userId/credits` | Add/remove credits |
| POST | `/api/admin/users/:userId/credits/promo` | Add promotional credits |
| POST | `/api/admin/users/:userId/credits/reverse` | Reverse credits |
| PATCH | `/api/admin/users/:userId/plan` | Change user's plan |
| PATCH | `/api/admin/users/:userId/cap` | Set cap override |
| POST | `/api/admin/users/:userId/pause` | Pause account |
| POST | `/api/admin/users/:userId/resume` | Resume account |
| POST | `/api/admin/users/:userId/flag` | Set risk flag |
| GET | `/api/admin/users/:userId/ledger` | Full credit ledger |

---

## Phase 8: Frontend Implementation (Week 6-8)

### 8.1 Pricing Page

**Files:** `frontend/src/pages/PricingPage.tsx` (new)

#### Features
- Display subscription plans
- Plan comparison table
- Subscribe button (Stripe checkout)
- Trial eligibility indicator
- FAQ section

### 8.2 Subscription Management Page

**Files:** `frontend/src/pages/SubscriptionPage.tsx` (new)

#### Features
- Current plan display
- Next billing date
- Payment method info
- Upgrade/downgrade options
- Cancel subscription
- Reactivate subscription
- Link to Stripe customer portal

### 8.3 Enhanced Credits Page

**Files:** `frontend/src/pages/CreditsPage.tsx` (enhance)

#### Add Features
- Credit balance breakdown (included, rollover, purchased)
- Usage this cycle
- Estimated results remaining
- Auto top-up toggle and settings
- Top-up cap display
- Credit pack purchase
- Usage history graph

### 8.4 Billing History Page

**Files:** `frontend/src/pages/BillingHistoryPage.tsx` (new)

#### Features
- Invoices list
- Receipts
- Transaction history
- Export functionality

### 8.5 Admin Billing Dashboard

**Files:** `frontend/src/pages/AdminBillingPage.tsx` (new)

#### Features
- Revenue overview cards
- MRR chart
- Active subscribers count
- Churn rate
- Top-up revenue
- Failed payments alert
- At-risk users list

### 8.6 Admin Plan Management

**Files:** `frontend/src/pages/AdminPlansPage.tsx` (new)

#### Features
- Plan list with CRUD
- Plan configuration form
- Display order management
- Activation/deactivation

### 8.7 Admin Credit Rules

**Files:** `frontend/src/pages/AdminCreditRulesPage.tsx` (new)

#### Features
- Credit pricing configuration
- Enrichment mode toggle
- Duplicate handling settings
- Rule testing interface

### 8.8 Admin User Billing View

**Files:** `frontend/src/pages/AdminUserBillingPage.tsx` (new)

#### Features
- User billing summary
- Credit adjustment form
- Plan assignment
- Cap override
- Risk flag management
- Full ledger view

---

## Phase 9: Abuse Protection & Safeguards (Week 8)

### 9.1 Rate Limiting

**Files:** `backend/src/middleware/rateLimit.ts` (enhance)

#### Implementation

```typescript
// Per-account rate limits
const accountLimits = {
  maxJobsPerHour: 10,
  maxJobsPerDay: 50,
  maxResultsPerJob: 500,
  maxConcurrentJobs: 3
};

// Check before job submission
async function checkAccountLimits(userId: string): Promise<boolean>
```

### 9.2 Abuse Detection

**Files:** `backend/src/services/abuseDetection.ts` (new)

#### Implementation

```typescript
class AbuseDetectionService {
  // Detect suspicious patterns
  async analyzeUsagePatterns(userId: string): Promise<RiskScore>
  
  // Check for duplicate jobs
  async detectDuplicateJobs(userId: string, query: string): Promise<boolean>
  
  // Flag suspicious accounts
  async flagAccount(userId: string, reason: string): Promise<void>
  
  // Get risk score
  async getRiskScore(userId: string): Promise<number>
}
```

### 9.3 Admin Abuse Controls

**Files:** `backend/src/routes/admin/abuse.ts` (new)

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/abuse/flagged` | List flagged accounts |
| GET | `/api/admin/abuse/patterns` | Suspicious usage patterns |
| POST | `/api/admin/abuse/restrict/:userId` | Restrict account |
| POST | `/api/admin/abuse/ban/:userId` | Ban account |
| POST | `/api/admin/abuse/review/:userId` | Mark for review |

---

## Phase 10: Audit & Compliance (Week 8-9)

### 10.1 Audit Logging

**Files:** `backend/src/services/auditLog.ts` (new)

#### Implementation

```typescript
class AuditLogService {
  // Log admin action
  async logAdminAction(
    adminId: string,
    action: string,
    targetUserId: string,
    beforeValue: any,
    afterValue: any,
    reason: string
  ): Promise<void>
  
  // Get audit trail
  async getAuditTrail(userId: string): Promise<AuditEntry[]>
  
  // Get admin action log
  async getAdminActionLog(adminId?: string): Promise<AuditEntry[]>
}
```

### 10.2 Audit Endpoints

**Files:** `backend/src/routes/admin/audit.ts` (new)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/audit/user/:userId` | User's audit trail |
| GET | `/api/admin/audit/admin/:adminId` | Admin's actions |
| GET | `/api/admin/audit/recent` | Recent all actions |

---

## Migration & Deployment

### Database Migration Steps

1. Create new tables (billing_events, billing_alerts, usage_summary)
2. Add new columns to existing tables
3. Migrate existing credit_transactions to include new fields
4. Seed default subscription plans
5. Seed default credit packages

### Backward Compatibility

- Existing users retain their current credit balance
- Existing transactions remain valid
- New fields have safe defaults

### Feature Flags

Consider using feature flags for gradual rollout:
- `enable_auto_topup`
- `enable_rollover`
- `enable_enrichment_billing`
- `enable_spending_caps`

---

## Testing Checklist

### Unit Tests
- [ ] Credit calculation logic (standard, enriched, duplicates)
- [ ] Auto top-up trigger conditions
- [ ] Cap enforcement logic
- [ ] Rollover calculation
- [ ] Billing cycle management

### Integration Tests
- [ ] Stripe webhook handling
- [ ] Credit consumption during search
- [ ] Auto top-up execution
- [ ] Subscription renewal flow
- [ ] Payment failure handling

### E2E Tests
- [ ] Subscribe to plan
- [ ] Purchase credit pack
- [ ] Exhaust credits and trigger top-up
- [ ] Hit spending cap
- [ ] Admin credit adjustment

---

## Launch Configuration

Based on the spec, set these defaults:

```typescript
const launchConfig = {
  // Subscription
  starterPlan: {
    name: 'Starter',
    price: 9.90,
    credits: 500,
    billingInterval: 'month'
  },
  
  // Credit Rules
  creditsPerStandardResult: 1,
  creditsPerEnrichedResult: 3,
  enrichmentPricingMode: 'base_plus_enrichment',
  
  // Auto Top-Up
  autoTopUpEnabled: true,
  autoTopUpThreshold: 50,
  autoTopUpCredits: 250,
  autoTopUpPrice: 5.90,
  monthlyTopUpCap: 20.00,
  
  // Credit Packs
  creditPacks: [
    { credits: 250, price: 5.90 },
    { credits: 500, price: 10.90 },
    { credits: 1000, price: 19.90 }
  ],
  
  // Rollover
  rolloverEnabled: false
};
```

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| 1 | Week 1-2 | Schema updates, credit rules engine |
| 2 | Week 2-3 | Billing cycle management, webhooks |
| 3 | Week 3-4 | Auto top-up system |
| 4 | Week 4 | Manual credit purchases |
| 5 | Week 4-5 | Spending caps |
| 6 | Week 5 | Notification system |
| 7 | Week 5-6 | Admin reporting |
| 8 | Week 6-8 | Frontend implementation |
| 9 | Week 8 | Abuse protection |
| 10 | Week 8-9 | Audit logging |

**Total Estimated Duration: 8-9 weeks**

---

## Priority Order for MVP

If time-constrained, implement in this order:

1. **P0 - Critical**
   - Schema updates
   - Credit consumption rules
   - Subscription management frontend
   - Stripe webhook reliability

2. **P1 - High**
   - Auto top-up system
   - Spending caps
   - Credit pack purchases
   - Basic admin controls

3. **P2 - Medium**
   - Notifications
   - Admin reporting
   - Rollover logic

4. **P3 - Nice to have**
   - Advanced abuse detection
   - Detailed profitability reports
   - Audit logging
