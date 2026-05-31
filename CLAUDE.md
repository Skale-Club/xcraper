# Xcraper — CLAUDE.md

## Project Overview

Xcraper is a B2B lead generation SaaS that scrapes Google Maps via Apify to extract business contacts (phone, email, social media). Users buy credits to run searches and export results.

**Production URL:** https://xcraper.skale.club  
**Stack:** React + Vite (frontend) / Express + Drizzle + PostgreSQL (backend) / Supabase Auth / Apify / Stripe / Vercel

---

## Monorepo Structure

```
xcraper/
├── backend/          # Express API server
│   ├── src/
│   │   ├── db/       # Drizzle schema + queries
│   │   ├── routes/   # API endpoints
│   │   ├── services/ # Business logic (Apify, Stripe, billing)
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── scripts/  # One-off DB/Stripe scripts
│   └── drizzle/      # Migration files
├── frontend/         # React + Vite SPA
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── hooks/
│       └── lib/
├── supabase/         # Supabase migrations + config
├── api/              # Vercel serverless function entry point
└── .github/          # CI/CD workflows
```

---

## Commands

### Development

```bash
npm install              # Install all workspace dependencies (run from root)
npm run dev              # Backend + frontend concurrently
npm run dev:backend      # Backend only (tsx watch, port 3001)
npm run dev:frontend     # Frontend only (Vite, port 5173)
```

### Build & Deploy

```bash
npm run build            # Build backend (tsc + tsc-alias) + frontend (vite build)
npm run start            # Start production backend (node dist/index.js)
vercel --prod            # Deploy to production
```

### Database

```bash
npm run db:generate --workspace=backend   # Generate migration from schema changes
npm run db:push --workspace=backend       # Push schema directly (dev only)
npm run db:migrate --workspace=backend    # Run pending migrations
npm run db:studio --workspace=backend     # Drizzle Studio (visual DB editor)
npm run db:seed --workspace=backend       # Seed default settings
```

### Testing

```bash
npm run test --workspace=backend          # Run backend tests
npm run test --workspace=frontend         # Run frontend tests
npm run test:coverage --workspace=backend # Coverage report
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, Vite 7, Wouter, TanStack Query v5 |
| UI | shadcn/ui, Radix UI, Tailwind CSS, Framer Motion |
| Forms | React Hook Form + Zod |
| Backend | Node.js, Express, TypeScript (strict), ES2022 modules |
| ORM | Drizzle ORM (PostgreSQL) |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (JWT verified server-side) |
| Scraping | Apify Client |
| Payments | Stripe (one-time purchases + subscriptions) |
| Security | Helmet, express-rate-limit, CORS |
| Logging | Winston + Morgan |
| Testing | Vitest + Supertest (backend), Vitest + React Testing Library (frontend) |
| Deploy | Vercel (serverless functions + static SPA) |
| Captcha | Cloudflare Turnstile (via Supabase native integration) |

---

## Environment Variables

### Backend (`.env`)

```
DATABASE_URL                         # PostgreSQL connection string (Supabase pooler)
SUPABASE_URL                         # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY            # Supabase service role key (never commit)
APIFY_API_TOKEN                      # Apify API token
APIFY_WEBHOOK_SECRET                 # Shared secret for /api/webhooks/apify (sent as x-apify-webhook-secret header or ?secret= query)
GOOGLE_PLACES_API_KEY                # Google Places API (backend)
STRIPE_SECRET_KEY                    # Stripe secret key (sk_live_... in prod)
STRIPE_PAYMENTS_WEBHOOK_SECRET       # Signing secret for /api/payments/webhook
STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET  # Signing secret for /api/subscriptions/webhook
FRONTEND_URL                         # http://localhost:5173 (dev) / https://xcraper.skale.club (prod)
BACKEND_URL                          # http://localhost:3001 (dev)
PORT                                 # Default: 3001
NODE_ENV                             # development | production
ADMIN_EMAIL                          # Admin contact email
CREDITS_PER_SEARCH                   # Credits consumed per search (default: 1)
CREDITS_PER_CONTACT                  # Credits consumed per contact export (default: 1)
```

### Frontend (`.env`)

```
VITE_SUPABASE_URL          # Supabase project URL
VITE_SUPABASE_ANON_KEY     # Supabase anon/publishable key
VITE_API_URL               # Backend API URL (production only)
VITE_GOOGLE_MAPS_API_KEY   # Google Maps API (frontend)
VITE_TURNSTILE_SITE_KEY    # Cloudflare Turnstile site key
```

> **Note:** VITE_ variables are baked into the frontend bundle at build time. Never put secrets in VITE_ vars.

---

## Architecture Notes

### Authentication

- Supabase handles auth (email/password, Google OAuth, GitHub OAuth)
- Backend verifies Supabase JWTs on every request via `middleware/auth.ts`
- After login, `useAuth.tsx` calls `/auth/sync` to create/fetch the app-side user record
- Cloudflare Turnstile captcha integrated on login, register, and password reset forms

### Stripe Integration

- **Two webhook endpoints:**
  - `POST /api/payments/webhook` — one-time credit purchases
  - `POST /api/subscriptions/webhook` — subscription lifecycle events
- Both endpoints require raw body (not JSON-parsed) for signature verification
- Webhook secrets stored as `STRIPE_PAYMENTS_WEBHOOK_SECRET` and `STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET`
- Credit packages and subscription plans stored in DB with live Stripe `price_*` IDs

### Credit System

- Users have three credit buckets: `credits` (monthly), `rolloverCredits`, `purchasedCredits`
- Debits use `db.transaction()` with `SELECT ... FOR UPDATE` to prevent race conditions
- Transaction types: `monthly_grant`, `usage`, `refund`, `bonus`, `purchase`, `admin_adjustment`

### Rate Limiting

- Auth endpoints: 20 req / 15 min
- Search endpoints: 30 req / 1 min
- Admin endpoints: 200 req / 15 min
- General API: 1000 req / 15 min

### API Routing (Vercel)

- `/api/*` → Express server (serverless function in `api/`)
- Static SPA catch-all → `frontend/dist/index.html`
- Assets cached 1 year (immutable)
- Max function duration: 30s

### Path Aliases

- Backend: `@/*` → `backend/src/*`
- Frontend: `@/*` → `frontend/src/*`

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/db/schema.ts` | Full DB schema (Drizzle) |
| `backend/src/routes/payments.ts` | One-time credit purchase flow |
| `backend/src/routes/subscriptions.ts` | Subscription management + webhook |
| `backend/src/routes/search.ts` | Apify search trigger + SSE streaming |
| `backend/src/services/stripe.ts` | Stripe helper functions |
| `backend/src/middleware/auth.ts` | JWT verification middleware |
| `frontend/src/hooks/useAuth.tsx` | Auth context + Turnstile captcha |
| `frontend/src/pages/AuthPage.tsx` | Login / Register / Reset pages |
| `vercel.json` | Vercel routing + function config |

---

## Secrets Management

- Secrets are stored in Vercel environment variables (production) and `.env` files (local)
- `.env` files are in `.gitignore` — never commit them
- `.gitleaksignore` suppresses known false positives from gitleaks scans
- Run `gitleaks detect --source . --verbose` before pushing sensitive changes
