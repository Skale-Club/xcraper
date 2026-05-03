# xcraper (Google Maps Scraping)

## What This Is

Aplicação SaaS full-stack para raspagem de dados do Google Maps. Backend Express.js deployado no Vercel como serverless, frontend React/Vite, autenticação e banco de dados via Supabase (free tier). Workflow GitHub Actions faz keepalive horário para evitar que o Supabase pause por inatividade.

## Core Value

Usuários conseguem extrair e exportar dados de negócios do Google Maps de forma automatizada, sem precisar de infraestrutura própria.

## Current State

| Attribute | Value |
|-----------|-------|
| Type | Application |
| Version | 1.0.0 |
| Status | Production |
| Last Updated | 2026-05-03 |

## Requirements

### Core Features

- Scraping de dados do Google Maps via Apify
- Autenticação de usuários via Supabase Auth
- Armazenamento e exportação de resultados
- Keepalive automático para manter Supabase free tier ativo

### Validated (Shipped)

- [x] Backend Express.js no Vercel
- [x] Frontend React/Vite
- [x] Autenticação Supabase
- [x] Workflow keepalive GitHub Actions (parcialmente — falhando)

### Active (In Progress)

- [ ] Corrigir workflow keepalive — falhando desde run #631

### Planned (Next)

- To be defined during /paul:plan

## Constraints

### Technical Constraints

- Supabase free tier pausa após 7 dias de inatividade
- Backend deployado como serverless no Vercel (cold starts possíveis)
- Workflow GitHub Actions depende de variável `KEEPALIVE_URL` e secret `KEEPALIVE_SECRET`

### Business Constraints

- Supabase free tier: sem custo mas requer keepalive ativo

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React 18 + Vite | Tailwind, Radix UI, TanStack Query |
| Backend | Express.js + TypeScript | Vercel serverless |
| Database | PostgreSQL via Supabase | Drizzle ORM |
| Auth | Supabase Auth | |
| CI/CD | GitHub Actions | Keepalive workflow |
| Scraping | Apify | |

---
*PROJECT.md — Created 2026-05-03*
