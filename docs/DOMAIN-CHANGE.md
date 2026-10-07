# Changing the public domain of Xcraper

Moving Xcraper from one domain to another is a **configuration change plus the external
checklist below**. No application code needs to change; a test
(`backend/src/config/noDomainLiterals.test.ts`) fails the build if a production domain
literal sneaks back into the source.

Throughout this document `OLD` is the current domain (today `xcraper.skale.club`) and
`NEW` is the target, e.g. `xcraper.example.com`. Both are written as bare hostnames; URLs
always include `https://`.

Hosting does not matter for this checklist. It applies on Vercel and on the self-hosted
setup in [SELF-HOSTING.md](./SELF-HOSTING.md). If you are also moving hosts, do the two
changes **separately** (domain first or host first, never both on the same day), so a
failure has one possible cause.

---

## 1. Where the domain lives in the code

| Setting | Read in | Used for |
|---|---|---|
| `FRONTEND_URL` (backend) | `backend/src/config/urls.ts` -> `getAppUrl()`, `getCorsOrigins()` | Stripe Checkout `success_url` / `cancel_url`, Stripe billing portal `return_url`, the production CORS allowlist |
| `BACKEND_URL` (backend) | `backend/src/config/urls.ts` -> `getApiUrl()`, `getApifyWebhookUrl()` | The Apify webhook URL logged when a run starts. Optional: falls back to `FRONTEND_URL` in production |
| `CORS_ALLOWED_ORIGINS` (backend) | `backend/src/config/urls.ts` -> `getCorsOrigins()` | Extra browser origins, comma-separated. Use it to keep `OLD` working during the migration |
| `XPHERE_API_URL` (backend) | `backend/src/config/urls.ts` -> `getXphereUrl()` | Xphere base URL. Defaults to the canonical Xphere origin; a per-user URL saved in the profile page still wins |
| `VITE_API_URL` (frontend, build time) | `frontend/src/lib/config.ts` -> `getApiBaseUrl()` | Origin of the API **only** when it differs from the SPA's. Empty on Vercel and in docker-compose |
| `VITE_APP_URL` (frontend, build time) | `frontend/src/lib/config.ts` -> `getAppOrigin()` | OAuth and password-reset redirect URLs. Optional, defaults to `window.location.origin`, which already follows the domain |

Things that follow the domain automatically and need nothing: the Supabase OAuth
`redirectTo` (`<origin>/auth/callback`), password-reset `redirectTo`
(`<origin>/auth/reset-password`), the PWA manifest (built at runtime from the current
origin), every relative `/api/...` request, the SSE stream, and the mock browser bar on
the landing page.

---

## 2. Checklist

Do these in order. Steps marked **(before)** can be done ahead of the switch without
affecting `OLD`; steps marked **(switch)** take effect when traffic moves.

### 2.1 Preparation (before)

- [ ] Lower the DNS TTL of the `OLD` record to 300 s at least 24 h ahead.
- [ ] Decide whether `OLD` will keep working (recommended: redirect to `NEW` for 30+ days).
- [ ] Take note of the current values of `FRONTEND_URL`, `BACKEND_URL`, `VITE_API_URL`,
      `VITE_APP_URL` in the hosting dashboard, so you can roll back.
- [ ] Look for the old domain stored in the database (admin-saved settings can contain
      absolute URLs). Read-only query, run against the production database:

      ```sql
      select 'settings' as tbl, to_jsonb(s)::text ilike '%OLD%' as has_old from settings s
      union all
      select 'system_settings', to_jsonb(s)::text ilike '%OLD%' from system_settings s;
      ```

      Any `true` row means a logo, favicon or OG image URL points at `OLD`; re-save it from
      `/admin/settings` after the switch (uploaded assets normally live on Supabase
      Storage and are unaffected).

### 2.2 Hosting and DNS (before, then switch)

- [ ] **Vercel:** Project -> Settings -> Domains -> add `NEW`. Copy the DNS record Vercel
      asks for (CNAME for a subdomain, A for an apex).
      **Self-hosted (Coolify):** application -> Domains -> set `https://NEW`
      (see SELF-HOSTING.md section 4).
- [ ] **DNS:** create the record for `NEW` at your DNS provider and wait until the
      hosting dashboard reports the certificate as issued. Check:
      `curl -sI https://NEW/api/health` returns `200`.
- [ ] If the DNS provider is Cloudflare, set the record to "DNS only" (grey cloud) until the
      certificate is issued, then decide whether to proxy it.

### 2.3 Environment variables (switch)

Set these in the hosting environment (Vercel: Project -> Settings -> Environment
Variables, Production; Coolify: the application's Environment Variables), then
**redeploy**. `VITE_*` values are compiled into the bundle, so the frontend must be
rebuilt, not just restarted.

| Variable | New value | Notes |
|---|---|---|
| `FRONTEND_URL` | `https://NEW` | Required. No trailing slash needed (it is stripped) |
| `CORS_ALLOWED_ORIGINS` | `https://OLD` | Keeps the old origin working while it still serves users; remove after the transition |
| `BACKEND_URL` | `https://NEW` | Only if it is currently set. Leave unset in same-origin setups |
| `VITE_API_URL` | unchanged / empty | Change only if the API is on a different domain, and then to that API's new origin |
| `VITE_APP_URL` | `https://NEW` | Only if it is currently set; leave empty otherwise |

Nothing else reads the domain. In particular `XPHERE_API_URL` is about **Xphere's**
address, not Xcraper's; it changes only when Xphere itself moves.

### 2.4 Supabase Auth

Dashboard -> Authentication -> URL Configuration.

- [ ] **Site URL:** `https://NEW`. Sign-up confirmation and magic-link emails use it,
      because the app does not pass an explicit `emailRedirectTo`.
- [ ] **Redirect URLs:** add `https://NEW/auth/callback` and
      `https://NEW/auth/reset-password`. Keep the `OLD` entries until the transition ends
      (or add `https://NEW/**`).
- [ ] **Email templates** (Authentication -> Emails): if any template hardcodes the old
      domain instead of `{{ .SiteURL }}`, update it.
- [ ] **Google / GitHub OAuth apps:** the provider's "authorized redirect URI" is the
      Supabase project's `https://<project-ref>.supabase.co/auth/v1/callback`, which does
      **not** change. Only touch these if you use a Supabase custom domain, or if the
      OAuth consent screen lists "authorized domains" / a homepage URL: add `NEW` there
      (Google Cloud Console -> APIs & Services -> OAuth consent screen).

### 2.5 Stripe

Do it in both **test** and **live** mode.

- [ ] Developers -> Webhooks: point the two endpoints at the new host, keeping the same
      event lists:
      - `https://NEW/api/payments/webhook`
      - `https://NEW/api/subscriptions/webhook`

      Editing an endpoint's URL keeps its signing secret. Confirm that in the dashboard; if
      a secret did change, update `STRIPE_PAYMENTS_WEBHOOK_SECRET` /
      `STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET` (and `STRIPE_WEBHOOK_SECRET` if used) and
      redeploy.
- [ ] Checkout success/cancel URLs and the billing-portal return URL are built per session
      from `FRONTEND_URL`; nothing to configure in Stripe for them.
- [ ] Settings -> Billing -> Customer portal: update the "Default redirect link" and the
      terms/privacy URLs if they point at `OLD`.
- [ ] Settings -> Business -> Public details: update the business website.

### 2.6 Apify

- [ ] In the Apify Console, open each Actor or Task that has a webhook to Xcraper
      (Integrations / Webhooks tab) and change the request URL to
      `https://NEW/api/webhooks/apify`. Keep the shared secret: either as the
      `x-apify-webhook-secret` header or as `?secret=<APIFY_WEBHOOK_SECRET>` on the URL.
      The code does not register webhooks itself (it only logs the URL it expects), so
      this is the only place the address lives.
- [ ] Test it: `curl https://NEW/api/webhooks/apify/health`, then start a small search and
      watch it finish. Searches are also finalized by status polling, so a stale webhook
      degrades latency, it does not lose data.

### 2.7 Google Cloud (Maps / Places)

- [ ] **Maps JavaScript API key** (the browser key: `VITE_GOOGLE_MAPS_API_KEY`, or the one
      saved in `/admin/settings`): Google Cloud Console -> APIs & Services -> Credentials ->
      the key -> Application restrictions -> HTTP referrers: add `https://NEW/*`. Keep
      `https://OLD/*` until the transition ends. Without this the contacts map shows a
      referrer error.
- [ ] **Places API key** (`GOOGLE_PLACES_API_KEY`, used by the backend): not tied to the
      domain. If it is restricted by IP, it is affected by a **host** move (new egress IP),
      not a domain move.

### 2.8 Cloudflare Turnstile (captcha)

- [ ] Cloudflare dashboard -> Turnstile -> the widget -> Hostname Management: add `NEW`
      (and keep `OLD` during the transition). The site key (`VITE_TURNSTILE_SITE_KEY`) and
      the secret stored in Supabase (Authentication -> Attack Protection) stay the same.
      Without this, login, sign-up and password reset fail with a captcha error on `NEW`.

### 2.9 Systems that call Xcraper, or that Xcraper pushes to

- [ ] **Hermes agent:** it calls Xcraper's machine-to-machine API
      (`POST /api/service/scrape`, `GET /api/service/scrape/:id`,
      `POST /api/service/scrape/:id/push`, header `X-Service-Key`). Update the Xcraper base
      URL in the Hermes configuration (its env or skill definition on the host that runs
      Hermes) to `https://NEW`. The service key itself does not change. Verify with
      `curl -s -H "X-Service-Key: $KEY" https://NEW/api/service/scrape/<id>`.
- [ ] **Xphere:** Xcraper pushes leads to Xphere (outbound), so Xphere's address is
      unaffected. Check in Xphere for anything that stores **Xcraper's** URL: an
      allowed-origin or IP restriction on the API key, an integration/webhook entry, or a
      link back to the source. This cannot be verified from this repository.
- [ ] **GitHub Actions keepalive:** repository variable `KEEPALIVE_URL`
      (Settings -> Secrets and variables -> Actions -> Variables) -> `https://NEW/api/keepalive`.
      The workflow is `.github/workflows/keepalive.yml`.
- [ ] **Uptime monitors / status pages** pointing at `OLD`.
- [ ] **Homelab scraper (Cloudflare Access):** direction is Xcraper -> homelab, authenticated
      by a service token, so a domain change does not affect it.

### 2.10 SEO and branding

- [ ] There is no `sitemap.xml`, `robots.txt` or `<link rel="canonical">` in the repo, and
      `frontend/index.html` has no absolute URLs, so there is nothing to edit in code. Title,
      description, `og:image` and the favicon come from `/admin/settings` (SEO and
      Branding): re-check them after the switch (see the SQL query in 2.1).
- [ ] Google Search Console: add `NEW` as a property; once the redirect from `OLD` is live,
      use "Change of address" on the `OLD` property.
- [ ] Redirect `OLD` -> `NEW` with a permanent (301) redirect, keeping the path and query.
      Vercel: Domains -> `OLD` -> Redirect to `NEW`. Coolify/Traefik: add a redirect
      middleware, or keep `OLD` as a second domain on the same application and redirect at
      the DNS/CDN layer.
- [ ] Social profiles, emails signatures, ads, and any Xmail/Xphere template that links to
      `OLD`.

### 2.11 Repository housekeeping

- [ ] Update the production URL in `CLAUDE.md` and `README.md`.
- [ ] Add `NEW` to the `FORBIDDEN` list in `backend/src/config/noDomainLiterals.test.ts`
      and **keep** `OLD` there, so neither can be hardcoded again.

---

## 3. What users will notice

- **They are signed out.** Supabase stores the session in `localStorage`, which is per
  origin. Everyone logs in again on `NEW`.
- **Installed PWAs stop working.** A PWA is bound to the origin it was installed from; users
  reinstall from `NEW`. The service worker is per origin, so nothing stale lingers.
- **Bookmarks and shared links** keep working only if the `OLD` -> `NEW` redirect is in place
  (section 2.10).

---

## 4. Verification after the switch

```bash
curl -sI https://NEW/                       # 200, text/html
curl -s  https://NEW/api/health             # {"status":"ok",...}
curl -s  https://NEW/api/webhooks/apify/health
# CORS: the allowed origin is echoed back, others are not
curl -sI -H "Origin: https://NEW" https://NEW/api/health | grep -i access-control-allow-origin
curl -sI -H "Origin: https://evil.example" https://NEW/api/health | grep -ci access-control-allow-origin   # 0
```

Then in a private browser window:

- [ ] Sign up or log in with email, with Google and with GitHub (each returns to
      `NEW/auth/callback`, not to `OLD`).
- [ ] Request a password reset; the emailed link opens `NEW/auth/reset-password`.
- [ ] The Turnstile widget renders on the login form.
- [ ] Buy a credit pack in Stripe **test** mode; you land on `NEW/billing?payment=success`
      and the credits arrive (proves the webhook reached `NEW`). Open the billing portal and
      return to `NEW/billing`.
- [ ] Run a small search and watch the live progress (SSE) finish.
- [ ] Open the contacts map (Google Maps referrer restriction).
- [ ] Trigger a Hermes scrape through the service API.

## 5. Rollback

Everything above is additive until `OLD` is removed, so rollback is cheap:

1. Put `FRONTEND_URL` (and `BACKEND_URL` / `VITE_*` if you changed them) back to the values
   you noted in 2.1 and redeploy.
2. Point the two Stripe webhooks and the Apify webhook back to `OLD`.
3. Supabase Site URL back to `OLD`. The extra redirect URLs can stay.

Do not remove the `OLD` entries from Supabase, Stripe, Google Cloud, Turnstile and CORS
until the redirect has been live for your chosen period and traffic on `OLD` is
negligible.
