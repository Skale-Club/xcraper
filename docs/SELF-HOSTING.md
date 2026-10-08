# Self-hosting Xcraper (Docker, Coolify on a VPS)

Production still runs on Vercel. This document describes the portable setup that lives
next to it in the repository, how to run it, and how to move over from Vercel with little
or no downtime and a quick way back. **Nothing here changes what Vercel builds or serves.**

Related: [DOMAIN-CHANGE.md](./DOMAIN-CHANGE.md) (changing the public domain, which is a
separate operation from changing the host).

> Status: the Dockerfiles, nginx config and compose file were written carefully but **not
> built or run** on the machine where they were authored (docker was off limits there).
> Do the first build on the VPS, or in CI, as a dry run (section 5) before any DNS change.

---

## 1. What is in the repo

| File | Purpose |
|---|---|
| `backend/Dockerfile` | API image. Multi-stage, Node 20 Alpine, non-root (`node`), healthcheck on `/api/health`, runs `node dist/index.js` |
| `frontend/Dockerfile` | Vite build served by `nginx-unprivileged` (non-root, port 8080), healthcheck on `/healthz` |
| `frontend/docker/nginx.conf.template` | SPA fallback, immutable `/assets`, and the `/api` reverse proxy (SSE-safe). Mirrors `vercel.json` |
| `docker-compose.yml` | Wires `xcraper-api` and `xcraper-web`. Nothing is published on the host; the domain is attached to `xcraper-web` |
| `.env.example` (root) | Every variable the compose file reads |
| `.dockerignore` | Keeps the build context (repo root) small |

Topology:

```
browser -> Traefik (Coolify, TLS) -> xcraper-web  nginx :8080
                                       |-- static SPA (frontend/dist)
                                       '-- /api/*  -> xcraper-api :3001  (Express)
```

The browser sees **one origin**, exactly as with Vercel's rewrites. That is why
`VITE_API_URL` stays empty, CORS is not exercised, and Stripe/Supabase/Apify only ever see
one hostname.

### How the same code runs in both modes

- **Vercel:** `api/index.ts` imports `backend/dist/app.js` and calls `createApp()` per
  function instance. `VERCEL=1` is set, so `backend/src/index.ts` does not call `listen()`.
- **Docker / any VPS:** `backend/src/index.ts` is the entrypoint. It calls
  `createApp()`, listens on `PORT`, and closes the server on `SIGTERM`/`SIGINT` so a
  redeploy lets in-flight requests finish.
- Both go through the same `createApp()` (helmet, CORS, rate limits, every route).

Differences you should know about:

| Concern | Vercel | Docker |
|---|---|---|
| Request duration | `maxDuration` 30-60 s (see `vercel.json`) | No platform limit. nginx allows 120 s for `/api`, 1 h for SSE |
| SSE (`/api/sse`) | Bounded by the function duration limit | Long-lived. nginx buffering is off for it |
| Log files | Not written (read-only fs) | `LOG_TO_FILE=false` in the image: stdout only (`docker logs`) |
| Client IP / rate limit | `trust proxy` = 1 (Vercel edge) | `TRUST_PROXY=2` (Traefik -> nginx -> API). Without this every visitor shares the proxy's IP and the 1000 req / 15 min limiter trips for everyone |
| Static caching | `vercel.json` headers | nginx: `/assets` immutable, `index.html` and the service worker `no-cache` |
| Cron | None used (the keepalive is a GitHub Actions workflow) | Same: nothing to schedule on the host |

The homelab search queue advances when something reads it (see README, "Homelab scraper"),
which works the same in a long-running process.

---

## 2. Prerequisites

- A VPS with Coolify installed and a working wildcard or per-app domain setup (Traefik
  issues the certificates).
- 1 vCPU / 1 GB RAM is enough for the API; the web container is a few MB. The image build
  (TypeScript + Vite) wants about 1.5 GB free memory: build in CI or add swap on a tiny VPS.
- The **database stays where it is** (Supabase Postgres). There is no database to migrate
  for this move. Authentication stays on Supabase Auth too.
- If Supabase "Network restrictions" are on, add the VPS's public IP to the allowlist.
- If `GOOGLE_PLACES_API_KEY` is restricted by IP in Google Cloud, add the VPS IP.
- DNS control of the domain.

---

## 3. Environment variables

Defined once, in Coolify (or in `.env` for a local run). The compose file turns them into
runtime env for the API and build args for the web image. The full annotated list is the
root [`.env.example`](../.env.example).

**Runtime, API (restart is enough to change them):**

| Variable | Required | Default / note |
|---|---|---|
| `FRONTEND_URL` | yes | Public `https://` origin. Stripe return URLs and the CORS origin |
| `DATABASE_URL` | yes | Supabase pooled connection string |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes | |
| `APIFY_API_TOKEN` | yes | |
| `APIFY_WEBHOOK_SECRET` | recommended | Webhook fails closed without it |
| `STRIPE_SECRET_KEY`, `STRIPE_PAYMENTS_WEBHOOK_SECRET`, `STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET` (`STRIPE_WEBHOOK_SECRET` legacy) | for billing | |
| `GOOGLE_PLACES_API_KEY` | for place autocomplete | |
| `XCRAPER_SERVICE_KEY`, `XCRAPER_SERVICE_USER_EMAIL` | for Hermes | Service API fails closed without a key |
| `XCRAPER_SERVICE_KEYS` | for more agents (Kai) | `name=key,name2=key2`, one key per agent, caller name goes to the log |
| `XPHERE_API_URL`, `XPHERE_API_KEY` | optional | URL defaults to the canonical Xphere origin |
| `SUPER_ADMIN_EMAIL`, `ADMIN_EMAIL`, `KEEPALIVE_SECRET`, `SENTRY_DSN` | optional | |
| `HOMELAB_SCRAPER_*` | optional | |
| `BACKEND_URL` | no | Leave empty: falls back to `FRONTEND_URL` in production |
| `CORS_ALLOWED_ORIGINS` | no | Extra origins, comma-separated (the old domain during a migration) |
| `TRUST_PROXY` | no | `2` in the compose file. Use `1` if you route straight to the API |
| `LOG_LEVEL` | no | `info` |

**Build time, web image (changing one needs a rebuild/redeploy):**
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (required), `VITE_API_URL` and `VITE_APP_URL`
(leave empty), `VITE_TURNSTILE_SITE_KEY`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_SENTRY_DSN`.
In Coolify, make sure these are available at **build time** (the variable's build option),
not only at runtime.

Never put secrets in a `VITE_*` variable: they end up in the public JS bundle.

---

## 4. Deploying on Coolify

1. **New Resource -> Docker Compose** (build pack "Docker Compose"), source: the GitHub
   repository, branch: the one you want to deploy (use a staging branch for the dry run;
   production should follow `main`). Compose file location: `/docker-compose.yml`.
2. **Environment variables:** paste the variables from section 3. The compose file refuses
   to start if a required one is missing and says which.
3. **Domains:** for the `xcraper-web` service set `https://<your-domain>:8080`. The `:8080`
   tells Traefik which container port to route to. Do not assign a domain to
   `xcraper-api`: it is reachable only through nginx, on the internal network.
4. **Deploy.** Check the logs of both services; both should turn healthy within a minute
   (`xcraper-api` waits for its 20 s start period).
5. Disable "auto deploy on push" at first, so production does not move on every commit
   while you are still validating.

Service names are prefixed (`xcraper-api`, `xcraper-web`) on purpose. Coolify attaches all
stacks to a shared Docker network, and a generic `backend` would collide with other apps.

Local smoke test (any machine with Docker; not needed for Coolify):

```bash
cp .env.example .env              # fill in the values
printf 'services:\n  xcraper-web:\n    ports: ["8080:8080"]\n' > docker-compose.override.yml
docker compose up --build         # http://localhost:8080
```

`docker-compose.override.yml` is already in `.gitignore`.

---

## 5. Dry run on a temporary domain

Prove the stack works before touching production DNS.

1. Create a throwaway hostname, e.g. `xcraper-next.<your-domain>`, pointing at the VPS, and
   use it as `FRONTEND_URL` for the Coolify app.
2. Add that hostname to the same external lists as in DOMAIN-CHANGE.md sections 2.4
   (Supabase redirect URLs), 2.7 (Google Maps referrers) and 2.8 (Turnstile hostnames).
3. Check:
   - `curl -s https://xcraper-next.<your-domain>/api/health` and `/healthz`
   - the landing page loads, deep links such as `/billing` return the app (SPA fallback)
   - log in, run a small search, watch progress arrive live (SSE through nginx)
   - rate limiting is per visitor, not per proxy: from two different networks, hit
     `/api/auth/...` and confirm one does not consume the other's budget (or read
     `docker logs xcraper-api` and confirm the logged `ip` is the client's, not an
     internal address)

   Do **not** run real payments here: the live Stripe webhook still points at Vercel.

The dry-run stack talks to the **production** Supabase project. Keep the testing to
read-mostly flows and your own account.

---

## 6. Cutover from Vercel (low downtime)

The key idea: **keep the same domain and change only where DNS points.** Supabase, Stripe,
Apify, Google, Turnstile and Hermes all know the domain, not the host, so none of them needs
touching. (If you also want a different domain, do that afterwards with DOMAIN-CHANGE.md.)

Both stacks are stateless and use the same database and the same secrets, so during the DNS
overlap it does not matter which one a given request reaches.

**A day before**
- [ ] Lower the DNS TTL of the production record to 300 s.
- [ ] Make the Coolify app serve the **production** domain: set `FRONTEND_URL` to the
      production origin and redeploy. Traefik cannot obtain a certificate for a domain that
      does not resolve to the VPS yet, so choose one:
      - **Zero-gap (recommended):** configure Traefik's DNS-01 challenge in Coolify
        (Servers -> Proxy -> Cloudflare/other DNS provider token) so the certificate is issued
        before DNS moves; or
      - **Accept 1-3 minutes of HTTPS errors** right after the DNS change while the HTTP-01
        challenge completes.
- [ ] Test the production hostname against the VPS before DNS moves:
      `curl --resolve <domain>:443:<VPS_IP> -k https://<domain>/api/health`
      (`-k` is only needed if the certificate is not issued yet).
- [ ] Add the VPS IP to the allowlists in section 2 (Supabase network restrictions, Google
      Places key).
- [ ] Confirm the environment variables in Coolify match the Vercel production ones
      (compare names and values; the Stripe, Apify and service-key secrets must be
      identical or webhooks will be rejected by one of the two stacks).

**Cutover**
1. Point the production DNS record at the VPS (A record to the VPS IP, or CNAME to a name
   that resolves there).
2. Watch `docker logs -f` on `xcraper-api` and the Coolify proxy logs. Requests start
   arriving as caches expire (at most the TTL, 5 minutes).
3. Run the verification list in DOMAIN-CHANGE.md section 4 against the production domain
   (sign-in with each provider, a Stripe **test**-mode purchase if you can, a small search
   with live progress, the contacts map, a Hermes scrape).
4. Leave the Vercel deployment untouched and serving whoever still resolves to it.

**After**
- [ ] After a few days of clean operation, remove the domain from the Vercel project and
      disconnect its Git integration. Until you do, a push to `main` still triggers a Vercel
      build that no longer serves anyone.
- [ ] Enable "auto deploy on push" in Coolify for the production branch.
- [ ] Update `KEEPALIVE_URL` only if the domain changed (it does not in this plan).
- [ ] Raise the DNS TTL back.
- [ ] Update the "Deploy" row in `CLAUDE.md` and the README.

### What gets different on the new host (and what to watch)

- **Single instance.** Rate-limit counters and the SSE connection registry are in memory.
  Run one replica of `xcraper-api`. (Search progress still reaches clients on a second
  instance because the SSE endpoint also polls the database, but rate limits would be per
  instance.) Scaling out needs a shared store first.
- **No automatic scaling or isolation** between requests: a heavy export now shares one
  Node process with everyone. Watch memory (`docker stats`) the first week; add a
  `mem_limit` to the compose service once you know the baseline.
- **Egress IP changes.** Anything that allowlists Vercel's IPs (none known) or yours.
- **Backups and uptime are now yours** for the app tier. The database remains on Supabase.

---

## 7. Rollback

While the Vercel project is intact (do not delete its env vars or domain for the first two
weeks), rolling back is a DNS change:

1. Point the production record back at Vercel (the previous value; note it before the
   cutover). With the 300 s TTL, traffic is back within minutes.
2. If you had already removed the domain from the Vercel project, re-add it
   (Project -> Settings -> Domains) before changing DNS.
3. Nothing else needs to change, because the domain never moved. The Stripe, Apify,
   Supabase and Hermes settings were not touched.

Rolling back a bad **release** on the VPS (not the whole move): in Coolify, redeploy the
previous commit from the application's deployments list.

---

## 8. Day-to-day operations

- **Logs:** `docker logs -f <container>` or the Coolify log view. The API logs JSON to
  stdout in production.
- **Update:** push to the tracked branch (auto deploy) or press Deploy. Coolify builds both
  images and replaces the containers; `SIGTERM` handling lets in-flight requests complete.
- **Database migrations:** the runtime image has no `drizzle-kit`. Run migrations as today,
  from a dev machine or CI with `DATABASE_URL` set:
  `npm run db:migrate --workspace=backend`.
- **Health:** `GET /api/health` (API, also reachable through the web container) and
  `GET /healthz` (nginx only). Point your uptime monitor at the public `/api/health`.
- **Changing a `VITE_*` value:** edit the variable and redeploy the web service; a restart
  is not enough.

---

## 9. What still depends on Vercel

Nothing in the Docker path does. The following Vercel-specific pieces remain in the repo
and are inert there:

- `vercel.json`, `backend/vercel.json`, `api/index.ts` and the `@vercel/node` dev
  dependency: the production deploy path until the cutover.
- `process.env.VERCEL === '1'` checks in `backend/src/config/runtime.ts` (and the logger),
  which only decide between "export a handler" and "listen".
- The `maxDuration` limits in `vercel.json`: they shape behaviour on Vercel only.
- The GitHub Actions keepalive and CI workflows are host-independent.
