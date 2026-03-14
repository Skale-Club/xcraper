# Longo Prazo (2-3 meses) - Features Avançadas

Funcionalidades que expandem o produto e aumentam o valor para clientes enterprise.

## 👥 1. Team Workspaces

**Estimativa**: 7-10 dias

### Database Schema

- [ ] Criar tabela `workspaces`
  ```typescript
  {
    id: uuid;
    name: string;
    slug: string; // URL-friendly
    ownerId: uuid; // FK to users
    credits: number; // Pool compartilhado
    plan: 'free' | 'team' | 'enterprise';
    maxMembers: number;
    isActive: boolean;
    createdAt: timestamp;
    updatedAt: timestamp;
  }
  ```

- [ ] Criar tabela `workspace_members`
  ```typescript
  {
    id: uuid;
    workspaceId: uuid;
    userId: uuid;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    permissions: jsonb; // {canSearch: true, canExport: true, ...}
    invitedBy: uuid;
    joinedAt: timestamp;
  }
  ```

- [ ] Criar tabela `workspace_invites`
  ```typescript
  {
    id: uuid;
    workspaceId: uuid;
    email: string;
    role: string;
    token: string; // Unique invite token
    invitedBy: uuid;
    expiresAt: timestamp;
    acceptedAt?: timestamp;
    createdAt: timestamp;
  }
  ```

- [ ] Migrar dados existentes:
  - Criar workspace default para cada usuário
  - Mover créditos de user para workspace
  - Atualizar FKs de contacts e searches

### Backend Routes

- [ ] `POST /api/workspaces` - Criar workspace
- [ ] `GET /api/workspaces` - Listar workspaces do usuário
- [ ] `GET /api/workspaces/:id` - Detalhes do workspace
- [ ] `PATCH /api/workspaces/:id` - Atualizar (owner/admin)
- [ ] `DELETE /api/workspaces/:id` - Deletar (owner only)

- [ ] `POST /api/workspaces/:id/invite` - Convidar membro
- [ ] `POST /api/workspaces/accept-invite/:token` - Aceitar convite
- [ ] `DELETE /api/workspaces/:id/members/:userId` - Remover membro

- [ ] `GET /api/workspaces/:id/credits` - Balance do workspace
- [ ] `POST /api/workspaces/:id/credits/transfer` - Transferir entre workspaces

### Permissions System

- [ ] Middleware `requireWorkspaceAccess(permission?)`
  ```typescript
  export function requireWorkspaceAccess(permission?: string) {
    return async (req, res, next) => {
      const { workspaceId } = req.params;
      const userId = req.user.id;

      const member = await getWorkspaceMember(workspaceId, userId);
      if (!member) return res.status(403).json({ error: 'Not a member' });

      if (permission && !member.permissions[permission]) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.workspace = member.workspace;
      next();
    };
  }
  ```

- [ ] Atualizar routes de search/contacts para usar workspace context

### Frontend

- [ ] Workspace switcher no header
- [ ] Página `/workspaces/new` - Criar workspace
- [ ] Página `/workspaces/:id/settings` - Configurações
  - Renomear
  - Gerenciar membros
  - Permissões por role
  - Transferir ownership
  - Deletar workspace

- [ ] Página `/workspaces/:id/members` - Lista de membros
  - Convidar por email
  - Alterar role
  - Remover membros

- [ ] Página `/workspaces/:id/billing` - Billing do workspace
  - Pool de créditos
  - Comprar créditos para workspace
  - Histórico de transações

### Email Templates

- [ ] Template: Workspace invite
- [ ] Template: Invite accepted
- [ ] Template: Member removed
- [ ] Template: Workspace low credits

---

## 📊 2. Advanced Analytics Dashboard

**Estimativa**: 5-7 dias

### Backend - Analytics Service

- [ ] Criar `backend/src/services/analytics.ts`
- [ ] Queries agregadas:
  ```typescript
  async function getWorkspaceStats(workspaceId: string, period: string) {
    return {
      searches: {
        total: number,
        byDay: Array<{date: string, count: number}>,
        topQueries: Array<{query: string, count: number}>
      },
      contacts: {
        total: number,
        saved: number,
        byCategory: Array<{category: string, count: number}>
      },
      credits: {
        balance: number,
        used: number,
        purchased: number,
        usageByDay: Array<{date: string, amount: number}>
      },
      members: {
        active: number,
        topContributors: Array<{userId: string, actions: number}>
      }
    };
  }
  ```

### Endpoints

- [ ] `GET /api/analytics/workspace/:id?period=7d`
- [ ] `GET /api/analytics/user?period=30d` - Stats pessoais
- [ ] `GET /api/analytics/admin` - Stats globais (admin)

### Frontend - Analytics Pages

- [ ] Página `/analytics` (workspace)
  - Cards com KPIs principais
  - Gráficos de linha (uso ao longo do tempo)
  - Top searches
  - Top categorias
  - Mapa de heat (onde mais buscamos)

- [ ] Biblioteca de charts (Recharts ou Chart.js)
- [ ] Filtros:
  - Período (7d, 30d, 90d, custom)
  - Por membro
  - Por categoria

### Export Reports

- [ ] Botão "Export Report" (PDF ou CSV)
- [ ] Scheduled reports (enviar por email semanal/mensal)

---

## 🔌 3. CRM Integrations

**Estimativa**: 10-14 dias

### Salesforce Integration

#### Setup OAuth

- [ ] Criar app Salesforce Connected App
- [ ] Implementar OAuth flow
- [ ] Armazenar tokens:
  ```typescript
  {
    userId: uuid;
    provider: 'salesforce';
    accessToken: string;
    refreshToken: string;
    instanceUrl: string;
    expiresAt: timestamp;
  }
  ```

#### Sync Contacts

- [ ] Botão "Export to Salesforce" na lista de contatos
- [ ] Mapear campos:
  ```
  Xcraper → Salesforce
  title → Company Name
  phone → Phone
  email → Email
  address → Street Address
  category → Industry
  ```

- [ ] Criar Leads ou Contacts (escolha do usuário)
- [ ] Bulk export (100+ contatos)
- [ ] Log de sync (success/failures)

### HubSpot Integration

- [ ] Similar flow OAuth
- [ ] Criar Companies e Contacts
- [ ] Associar contatos a deals (opcional)

### Zapier Integration

Mais fácil e escalável que integrações 1:1.

- [ ] Criar API pública (webhook-based)
- [ ] Trigger: "New Contact Saved"
  ```json
  {
    "event": "contact.created",
    "contact": { ...data }
  }
  ```

- [ ] Trigger: "Search Completed"
- [ ] Action: "Create Contact"
- [ ] Submeter app para Zapier App Directory

### Make (Integromat) Integration

- [ ] Similar ao Zapier
- [ ] Criar módulos Make

---

## 🔍 4. Advanced Search Features

**Estimativa**: 5-7 dias

### Backend - Enhanced Apify Parameters

- [ ] Adicionar filtros em `POST /api/search`:
  ```typescript
  {
    query: string;
    location: string;
    maxResults: number;
    filters?: {
      minRating?: number; // 3.5+
      minReviews?: number; // 10+
      openNow?: boolean;
      categories?: string[]; // ["restaurant", "cafe"]
      priceLevel?: number; // 1-4 ($-$$$$)
    }
  }
  ```

- [ ] Passar para Apify API
- [ ] Validar se Apify suporta esses filtros
- [ ] Ajustar custo se filtros avançados custarem mais

### Frontend - Advanced Search UI

- [ ] Accordion "Filtros Avançados" no Dashboard
- [ ] Inputs:
  - Rating mínimo (slider)
  - Número mínimo de reviews
  - Toggle "Aberto agora"
  - Multi-select categorias
  - Price level (chips: $, $$, $$$, $$$$)

### Saved Searches

- [ ] Tabela `saved_searches`
  ```typescript
  {
    id: uuid;
    userId: uuid;
    name: string; // "Pizza em SP - alta avaliação"
    query: string;
    location: string;
    filters: jsonb;
    createdAt: timestamp;
  }
  ```

- [ ] Endpoint `POST /api/saved-searches`
- [ ] Endpoint `GET /api/saved-searches`
- [ ] UI: Botão "Salvar busca" após executar
- [ ] UI: Dropdown para re-executar busca salva

### Scheduled Searches

- [ ] Campo `schedule` em `saved_searches`:
  ```typescript
  {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number; // 0-6
    time?: string; // "09:00"
  }
  ```

- [ ] Cron job para executar buscas agendadas
- [ ] Email quando busca agendada completa
- [ ] UI para configurar schedule

---

## 📦 5. Bulk Operations

**Estimativa**: 3-5 dias

### Bulk Search from CSV

- [ ] Upload CSV com queries:
  ```csv
  query,location,maxResults
  "pizza restaurants","New York, NY",20
  "coffee shops","San Francisco, CA",30
  ```

- [ ] Endpoint `POST /api/search/bulk` (upload file)
- [ ] Processar em background (job queue)
- [ ] Validar créditos antes de iniciar
- [ ] Deduzir créditos por batch
- [ ] Email quando todas buscas completarem

### Bulk Contact Import

- [ ] Importar contatos de CSV (sem Apify)
- [ ] Validar formato
- [ ] Deduzir créditos por contato importado (0.5 crédito?)
- [ ] Mapear colunas CSV para schema

### Bulk Export Enhancements

- [ ] Formatos adicionais: XLSX, VCF (vCard)
- [ ] Exportar com filtros aplicados
- [ ] Agendar exports recorrentes
- [ ] Email com link de download (S3 presigned URL)

---

## 🌐 6. White Label / Multi-Tenancy

**Estimativa**: 14-21 dias (complexo)

### Conceito

Permitir agências revendarem Xcraper com sua própria marca.

### Database Schema

- [ ] Tabela `tenants`
  ```typescript
  {
    id: uuid;
    name: string;
    domain: string; // custom-domain.com
    logoUrl: string;
    brandColor: string;
    supportEmail: string;
    settings: jsonb; // Override de settings global
    ownerId: uuid; // Admin do tenant
    plan: 'white_label_starter' | 'white_label_pro';
    isActive: boolean;
    createdAt: timestamp;
  }
  ```

- [ ] Adicionar `tenantId` em todas tabelas principais
- [ ] Migração massiva

### Multi-Tenant Middleware

- [ ] Detectar tenant por domínio ou subdomain:
  ```typescript
  function detectTenant(req: Request) {
    const host = req.get('host');
    // agency1.xcraper.com → tenant slug: agency1
    // custom.com → lookup tenant by domain
  }
  ```

- [ ] Middleware que injeta `req.tenant`
- [ ] Todas queries filtram por `tenantId`

### Tenant Admin Panel

- [ ] Tenant owner pode:
  - Customizar branding
  - Gerenciar usuários do tenant
  - Ver analytics agregados
  - Configurar pricing (markup sobre Xcraper)

### Isolation

- [ ] Usuários de um tenant não veem dados de outro
- [ ] Row-level security no Postgres
- [ ] Testes exaustivos de isolation

### Billing

- [ ] Tenant owner compra créditos em bulk
- [ ] Distribui para usuários do tenant
- [ ] Markup pricing (ex: Xcraper cobra $10, tenant cobra $15)

---

## 🤖 7. Public API

**Estimativa**: 7-10 dias

### API Keys

- [ ] Tabela `api_keys`
  ```typescript
  {
    id: uuid;
    userId: uuid;
    name: string; // "Production Key"
    key: string; // Hashed
    permissions: string[]; // ["search", "contacts.read"]
    rateLimit: number; // Requests per hour
    lastUsedAt?: timestamp;
    expiresAt?: timestamp;
    createdAt: timestamp;
  }
  ```

- [ ] Endpoint `POST /api/keys` - Gerar nova key
- [ ] Endpoint `GET /api/keys` - Listar keys
- [ ] Endpoint `DELETE /api/keys/:id` - Revogar

### API Authentication

- [ ] Middleware `requireApiKey`
  ```typescript
  Authorization: Bearer xc_live_abc123...
  ```

- [ ] Verificar hash, expiração, rate limit
- [ ] Atribuir custos ao usuário normalmente

### API Endpoints (Public)

- [ ] `POST /v1/search` - Executar busca
- [ ] `GET /v1/searches/:id` - Status da busca
- [ ] `GET /v1/contacts` - Listar contatos
- [ ] `POST /v1/contacts` - Criar contato manual
- [ ] `GET /v1/credits/balance` - Ver balance

### Documentation

- [ ] OpenAPI spec (Swagger)
- [ ] Página `/docs/api` com Swagger UI
- [ ] Exemplos em múltiplas linguagens:
  - cURL
  - JavaScript (fetch)
  - Python (requests)
  - PHP

### SDKs (Opcional)

- [ ] SDK JavaScript/TypeScript (npm)
- [ ] SDK Python (PyPI)

---

## 🎓 8. Educational Content & SEO

**Estimativa**: 5-7 dias (content-heavy)

### Blog System

- [ ] Tabela `blog_posts`
  ```typescript
  {
    id: uuid;
    slug: string;
    title: string;
    excerpt: string;
    content: text; // Markdown
    coverImageUrl?: string;
    authorId: uuid;
    publishedAt?: timestamp;
    status: 'draft' | 'published';
    seoTitle: string;
    seoDescription: string;
    tags: string[];
    createdAt: timestamp;
    updatedAt: timestamp;
  }
  ```

- [ ] Endpoints CRUD (admin only)
- [ ] Frontend: `/blog` (listagem)
- [ ] Frontend: `/blog/:slug` (post individual)
- [ ] Markdown renderer (react-markdown)

### SEO Content

Escrever artigos:
- [ ] "How to Generate Leads from Google Maps"
- [ ] "Best Practices for B2B Lead Generation"
- [ ] "Xcraper vs Manual Scraping: ROI Comparison"
- [ ] "GDPR Compliance for Lead Generation"
- [ ] "10 Ways to Use Google Maps Data"

### Video Tutorials

- [ ] Gravar screencasts:
  - Quick start (3 min)
  - Advanced search (5 min)
  - Team collaboration (5 min)
  - API integration (8 min)

- [ ] Upload no YouTube
- [ ] Embed na landing page e docs

### Help Center / Knowledge Base

- [ ] Tabela `help_articles` (similar a blog)
- [ ] Categorias:
  - Getting Started
  - Billing & Credits
  - Search Tips
  - Exports & Integrations
  - Troubleshooting

- [ ] Search dentro do help center
- [ ] Widget de ajuda (Intercom-style)

---

## ✅ Checklist de Conclusão

Funcionalidades prontas para Enterprise:

- [ ] ✅ Team workspaces funcionando com permissões
- [ ] ✅ Analytics dashboard com insights valiosos
- [ ] ✅ Pelo menos 1 integração CRM ativa
- [ ] ✅ Advanced search com filtros úteis
- [ ] ✅ Bulk operations economizando tempo dos usuários
- [ ] ✅ API pública documentada e testada
- [ ] ✅ Blog/Help center com 10+ artigos
- [ ] ✅ White label (se for esse o caminho) isolado e seguro

---

**Anterior**: [02-medio-prazo.md](02-medio-prazo.md)
**Próximo**: [04-seguranca.md](04-seguranca.md)
