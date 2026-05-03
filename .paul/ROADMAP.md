# Roadmap: xcraper

## Overview

Aplicação de scraping do Google Maps com backend Vercel + Supabase. Foco atual: estabilizar infraestrutura de keepalive para garantir disponibilidade contínua no free tier.

## Current Milestone

**v1.1 Keepalive Estável**
Status: In progress
Phases: 0 of 1 complete

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 1 | Fix Keepalive | 3 | Not started | - |

## Phase Details

### Phase 1: Fix Keepalive

**Goal:** Workflow GitHub Actions executa sem erros; Supabase free tier nunca pausa por falta de ping.

**Depends on:** Nothing

**Research:** Unlikely (problema bem diagnosticado)

**Scope:**
- Endpoint `/api/keepalive` sempre retorna 200 (desacoplar ping de health check)
- Workflow GitHub Actions tolerante a falhas parciais
- Ping direto ao Supabase no workflow como fallback independente do backend

**Plans:**
- [ ] 01-01: Corrigir endpoint keepalive — retornar 200 sempre, erros apenas no body
- [ ] 01-02: Adicionar ping direto ao Supabase no workflow (fallback)
- [ ] 01-03: Ajustar curl no workflow para não falhar em 503

---
*Roadmap created: 2026-05-03*
