# syntax=docker/dockerfile:1.7
#
# Xcraper web image: Vite build served by nginx, with /api reverse-proxied to
# the backend so the browser sees ONE origin (exactly what Vercel's rewrites
# give today). Build context is the REPOSITORY ROOT:
#
#   docker build -f frontend/Dockerfile -t xcraper-web \
#     --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... .
#
# VITE_* values are compiled into the JS bundle, so they are build ARGs, not
# runtime env. Changing one means rebuilding the image.

ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace=frontend --no-audit --no-fund
COPY frontend frontend

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL=
ARG VITE_APP_URL=
ARG VITE_TURNSTILE_SITE_KEY=
ARG VITE_GOOGLE_MAPS_API_KEY=
ARG VITE_SENTRY_DSN=
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_API_URL=$VITE_API_URL \
    VITE_APP_URL=$VITE_APP_URL \
    VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY \
    VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN npm run build --workspace=frontend

# Unprivileged nginx: runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
# Rendered into /etc/nginx/conf.d/default.conf by the image entrypoint.
COPY frontend/docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/dist /usr/share/nginx/html

# Where /api is proxied. Resolved per request through Docker's embedded DNS, so
# the web container starts (and survives backend redeploys) without the backend.
ENV BACKEND_UPSTREAM=xcraper-api:3001 \
    DNS_RESOLVER=127.0.0.11

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
