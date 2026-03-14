# Melhorias Arquiteturais

Padrões e práticas para escalabilidade e manutenibilidade.

## 🏗️ 1. Resiliência e Fault Tolerance

**Estimativa**: 3-5 dias

### Circuit Breaker Pattern

Proteger contra falhas em cascata quando Apify está down.

- [ ] Instalar biblioteca
  ```bash
  npm install opossum
  ```

- [ ] Implementar para Apify:
  ```typescript
  import CircuitBreaker from 'opossum';

  const apifyBreaker = new CircuitBreaker(apifyClient.actor.call, {
    timeout: 30000, // 30s
    errorThresholdPercentage: 50, // Abrir se 50% falharem
    resetTimeout: 60000, // Tentar novamente após 1min
    volumeThreshold: 10 // Mínimo de requests para avaliar
  });

  apifyBreaker.on('open', () => {
    logger.error('circuit_breaker_opened', { service: 'apify' });
    // Alert ops team
  });

  apifyBreaker.on('halfOpen', () => {
    logger.info('circuit_breaker_half_open', { service: 'apify' });
  });

  apifyBreaker.fallback(() => {
    // Fallback: retornar cached results ou error elegante
    return {
      error: 'Apify service temporarily unavailable. Please try again later.'
    };
  });

  // Usar
  const results = await apifyBreaker.fire(actorId, input);
  ```

- [ ] Circuit breaker para Stripe
- [ ] Circuit breaker para Supabase (menos crítico)

### Retry Logic with Exponential Backoff

- [ ] Biblioteca de retry:
  ```bash
  npm install async-retry
  ```

- [ ] Wrapper para chamadas externas:
  ```typescript
  import retry from 'async-retry';

  async function callApifyWithRetry(params: any) {
    return await retry(
      async (bail) => {
        try {
          return await apifyClient.actor.call(params);
        } catch (error) {
          // Não retry se erro 4xx (bad request)
          if (error.statusCode >= 400 && error.statusCode < 500) {
            bail(error);
            return;
          }

          // Retry em 5xx ou network errors
          throw error;
        }
      },
      {
        retries: 3,
        factor: 2, // Exponential backoff
        minTimeout: 1000,
        maxTimeout: 10000,
        onRetry: (error, attempt) => {
          logger.warn('retrying_apify_call', {
            attempt,
            error: error.message
          });
        }
      }
    );
  }
  ```

### Graceful Degradation

- [ ] Se Apify está down:
  - Mostrar mensagem ao usuário
  - Não deduzir créditos
  - Oferecer notificação quando voltar

- [ ] Se Stripe está down:
  - Permitir uso com créditos existentes
  - Bloquear apenas novas compras
  - Mostrar status banner

---

## 🔄 2. Background Jobs e Queues

**Estimativa**: 4-6 dias

### Job Queue (Bull/BullMQ)

Para processar tarefas assíncronas sem bloquear requests.

- [ ] Instalar Redis e BullMQ
  ```bash
  npm install bullmq ioredis
  ```

- [ ] Setup `backend/src/queues/index.ts`
  ```typescript
  import { Queue, Worker } from 'bullmq';
  import Redis from 'ioredis';

  const connection = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null
  });

  // Search queue
  export const searchQueue = new Queue('search', { connection });

  // Email queue
  export const emailQueue = new Queue('email', { connection });

  // Report queue
  export const reportQueue = new Queue('report', { connection });
  ```

### Search Worker

- [ ] Criar `backend/src/workers/searchWorker.ts`
  ```typescript
  import { Worker } from 'bullmq';

  const searchWorker = new Worker(
    'search',
    async (job) => {
      const { searchId, userId, query, location } = job.data;

      logger.info('processing_search_job', { searchId });

      try {
        // Atualizar status
        await updateSearchStatus(searchId, 'running');

        // Chamar Apify
        const results = await apifyService.search(query, location);

        // Salvar resultados
        await saveSearchResults(searchId, results);

        // Atualizar status
        await updateSearchStatus(searchId, 'completed');

        // Notificar usuário
        await emailQueue.add('search-completed', {
          userId,
          searchId,
          totalResults: results.length
        });

        logger.info('search_job_completed', { searchId });
      } catch (error) {
        await updateSearchStatus(searchId, 'failed');
        logger.error('search_job_failed', { searchId, error });
        throw error;
      }
    },
    {
      connection,
      concurrency: 5 // Processar 5 buscas em paralelo
    }
  );

  searchWorker.on('failed', (job, error) => {
    logger.error('search_worker_failed', {
      jobId: job.id,
      error: error.message
    });
  });
  ```

### Email Worker

- [ ] Criar `backend/src/workers/emailWorker.ts`
  ```typescript
  const emailWorker = new Worker(
    'email',
    async (job) => {
      const { type, to, data } = job.data;

      await sendEmail({
        to,
        template: type,
        data
      });
    },
    {
      connection,
      concurrency: 10 // Enviar 10 emails em paralelo
    }
  );
  ```

### Usar Queues

- [ ] Refatorar endpoint de search:
  ```typescript
  // Antes (síncrono - ruim)
  router.post('/search', async (req, res) => {
    const results = await apifyService.search(...); // Espera 10-30s
    res.json(results);
  });

  // Depois (assíncrono - bom)
  router.post('/search', async (req, res) => {
    const search = await createSearchRecord(req.user.id, req.body);

    // Adicionar job à queue
    await searchQueue.add('execute-search', {
      searchId: search.id,
      userId: req.user.id,
      ...req.body
    });

    // Responder imediatamente
    res.json({
      searchId: search.id,
      status: 'pending',
      message: 'Search queued. You will be notified when complete.'
    });
  });
  ```

### Job Monitoring

- [ ] Bull Board (UI para monitorar queues)
  ```bash
  npm install @bull-board/express
  ```

- [ ] Endpoint `/admin/queues` (admin only)
  - Ver jobs pendentes
  - Ver jobs falhados
  - Retry manual

---

## 📦 3. Caching

**Estimativa**: 2-3 dias

### Redis Cache

- [ ] Cache para queries frequentes:
  ```typescript
  import { createClient } from 'redis';

  const redis = createClient({ url: process.env.REDIS_URL });

  export async function getCachedSettings() {
    const cached = await redis.get('settings:public');

    if (cached) {
      return JSON.parse(cached);
    }

    const settings = await db.select().from(settings).limit(1);

    // Cache por 1 hora
    await redis.setEx('settings:public', 3600, JSON.stringify(settings));

    return settings;
  }
  ```

### Cache Invalidation

- [ ] Invalidar quando settings mudam:
  ```typescript
  // Em PATCH /api/settings
  await updateSettings(data);
  await redis.del('settings:public'); // Invalidar cache
  ```

### HTTP Cache Headers

- [ ] Assets estáticos (1 ano):
  ```typescript
  app.use('/static', express.static('public', {
    maxAge: '1y',
    immutable: true
  }));
  ```

- [ ] API responses (curto):
  ```typescript
  // GET /api/settings/public
  res.set('Cache-Control', 'public, max-age=300'); // 5 min
  ```

---

## 🗂️ 4. Database Optimization

**Estimativa**: 2-3 dias

### Indexes

- [ ] Analisar slow queries:
  ```sql
  SELECT * FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 20;
  ```

- [ ] Criar indexes necessários:
  ```sql
  -- Buscar contatos por usuário
  CREATE INDEX idx_contacts_user_id ON contacts(user_id);

  -- Filtrar por rating
  CREATE INDEX idx_contacts_rating ON contacts(rating) WHERE rating IS NOT NULL;

  -- Buscar por categoria
  CREATE INDEX idx_contacts_category ON contacts(category) WHERE category IS NOT NULL;

  -- Search history por usuário
  CREATE INDEX idx_search_history_user_id ON search_history(user_id);

  -- Transações por usuário e data
  CREATE INDEX idx_credit_transactions_user_date ON credit_transactions(user_id, created_at DESC);
  ```

### Partial Indexes

- [ ] Apenas records relevantes:
  ```sql
  -- Index apenas para buscas ativas
  CREATE INDEX idx_search_active ON search_history(user_id)
  WHERE status IN ('pending', 'running');

  -- Index apenas favoritos
  CREATE INDEX idx_contacts_favorites ON contacts(user_id)
  WHERE is_favorite = true;
  ```

### Connection Pooling

- [ ] Configurar pool adequadamente:
  ```typescript
  import { Pool } from 'pg';

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Máximo de conexões
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  ```

### Read Replicas (Escala)

- [ ] Configurar read replica no Postgres
- [ ] Direcionar queries read-only para replica:
  ```typescript
  // Write (master)
  const writeDb = drizzle(masterPool);

  // Read (replica)
  const readDb = drizzle(replicaPool);

  // Usar
  const contacts = await readDb.select().from(contacts); // Leitura
  await writeDb.insert(contacts).values(newContact); // Escrita
  ```

---

## 🔐 5. API Versioning

**Estimativa**: 2 dias

### Strategy

- [ ] URL versioning: `/api/v1/search`
- [ ] Manter v1 por tempo determinado (ex: 12 meses)
- [ ] Deprecation headers:
  ```typescript
  res.set('X-API-Deprecated', 'true');
  res.set('X-API-Sunset', '2025-12-31');
  ```

### Implementation

- [ ] Estrutura de pastas:
  ```
  backend/src/routes/
    v1/
      search.ts
      contacts.ts
    v2/
      search.ts  // Nova versão
  ```

- [ ] Registrar rotas:
  ```typescript
  app.use('/api/v1', routesV1);
  app.use('/api/v2', routesV2);
  ```

### Documentation

- [ ] Changelog de API
- [ ] Migration guide (v1 → v2)

---

## 🌐 6. Multi-Region Deployment

**Estimativa**: 7-10 dias (complexo)

### Strategy

Para baixa latência global.

#### Opção A: Edge Functions

- [ ] Deploy API em Cloudflare Workers ou Vercel Edge
- [ ] Database: PlanetScale (multi-region) ou CockroachDB

#### Opção B: Regional Clusters

- [ ] Deploy em múltiplas regiões (US-East, EU-West, Asia-Pacific)
- [ ] Load balancer global (CloudFlare, AWS Global Accelerator)
- [ ] Database replication entre regiões

### Database Replication

- [ ] Master-slave replication
- [ ] Ou multi-master (CockroachDB, YugabyteDB)

### CDN

- [ ] Frontend assets em CDN (CloudFlare, AWS CloudFront)
- [ ] Cache API responses no edge (quando possível)

---

## 📝 7. API Documentation

**Estimativa**: 2-3 dias

### OpenAPI Spec

- [ ] Gerar spec automático com swagger-jsdoc:
  ```typescript
  import swaggerJsdoc from 'swagger-jsdoc';

  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Xcraper API',
        version: '1.0.0',
        description: 'Lead generation API'
      },
      servers: [
        { url: 'https://api.xcraper.com/v1' }
      ]
    },
    apis: ['./src/routes/*.ts']
  };

  const swaggerSpec = swaggerJsdoc(options);
  ```

- [ ] Anotar routes:
  ```typescript
  /**
   * @openapi
   * /search:
   *   post:
   *     summary: Execute a Google Maps search
   *     tags: [Search]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               query:
   *                 type: string
   *               location:
   *                 type: string
   *     responses:
   *       200:
   *         description: Search created successfully
   */
  router.post('/search', ...);
  ```

### Swagger UI

- [ ] Endpoint `/api/docs`
  ```typescript
  import swaggerUi from 'swagger-ui-express';

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  ```

### Code Examples

- [ ] Gerar SDKs automaticamente (openapi-generator)
- [ ] Exemplos em:
  - cURL
  - JavaScript
  - Python
  - PHP

---

## 🧪 8. Testing Infrastructure

**Estimativa**: 5-7 dias

### Test Database

- [ ] Setup database separado para testes
  ```env
  TEST_DATABASE_URL=postgresql://...
  ```

- [ ] Reset database antes de cada suite:
  ```typescript
  beforeEach(async () => {
    await db.delete(users); // Limpar tables
    await db.delete(contacts);
    // ...
  });
  ```

### Factory Pattern

- [ ] Criar factories para test data:
  ```typescript
  // test/factories/user.ts
  export function createTestUser(overrides = {}) {
    return {
      id: uuidv4(),
      email: 'test@example.com',
      name: 'Test User',
      credits: 100,
      role: 'user',
      ...overrides
    };
  }

  // Usar em testes
  const user = await db.insert(users).values(createTestUser({ credits: 50 }));
  ```

### Integration Tests

- [ ] Testar fluxos completos:
  ```typescript
  describe('Search Flow', () => {
    it('should execute search, deduct credits, and save results', async () => {
      const user = await createTestUser({ credits: 100 });

      const response = await request(app)
        .post('/api/search')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ query: 'pizza', location: 'NYC' });

      expect(response.status).toBe(200);

      // Verificar créditos deduzidos
      const updatedUser = await getUser(user.id);
      expect(updatedUser.credits).toBe(99);

      // Verificar search criado
      const search = await getSearch(response.body.searchId);
      expect(search.status).toBe('pending');
    });
  });
  ```

### E2E Tests (Playwright)

- [ ] Testar frontend + backend juntos
- [ ] Cenários críticos:
  - Signup → Login → Search → Save Contact → Purchase
  - Admin login → Update settings

---

## ✅ Checklist Arquitetural

- [ ] ✅ Circuit breakers protegendo serviços externos
- [ ] ✅ Retry logic com exponential backoff
- [ ] ✅ Background jobs processando tarefas pesadas
- [ ] ✅ Caching reduzindo load no database
- [ ] ✅ Indexes otimizando queries lentas
- [ ] ✅ API versionada e documentada
- [ ] ✅ Testes cobrindo fluxos críticos
- [ ] ✅ Multi-region ready (se necessário)

---

**Anterior**: [07-billing-avancado.md](07-billing-avancado.md)
**Próximo**: [09-metricas.md](09-metricas.md)
