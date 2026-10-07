# syntax=docker/dockerfile:1.7
#
# Xcraper API image. Build context is the REPOSITORY ROOT (the npm workspace
# lockfile lives there):
#
#   docker build -f backend/Dockerfile -t xcraper-api .
#
# Runs dist/index.js as a long-lived process (src/index.ts calls app.listen()
# whenever VERCEL is not set). Vercel keeps using api/index.ts; this file is
# not involved in the Vercel build.

ARG NODE_VERSION=20

# ---- deps: full install (dev deps needed by tsc) ----------------------------
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace=backend --no-audit --no-fund
COPY backend backend
RUN npm run build --workspace=backend

# ---- prod-deps: runtime dependencies only ------------------------------------
FROM node:${NODE_VERSION}-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace=backend --omit=dev --no-audit --no-fund \
    && npm cache clean --force

# ---- runtime ------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    LOG_TO_FILE=false
WORKDIR /app/backend

# Whole /app from prod-deps: root node_modules (hoisted deps), any non-hoisted
# backend/node_modules, and the package.json files Node needs for "type": "module".
COPY --from=prod-deps --chown=node:node /app /app
COPY --from=build --chown=node:node /app/backend/dist ./dist

USER node
EXPOSE 3001

# /api/health answers without touching the database, so a slow DB never marks
# the container unhealthy (and never triggers a restart loop).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "dist/index.js"]
