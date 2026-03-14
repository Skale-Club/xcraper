# Observabilidade e Monitoring

Sistema completo de logging, metrics, alertas e debugging.

## 📝 1. Logging Estruturado

**Estimativa**: 2-3 dias (já incluído no curto prazo, aqui está o detalhamento)

### Winston Setup Completo

- [ ] Criar `backend/src/utils/logger.ts`
  ```typescript
  import winston from 'winston';
  import { ElasticsearchTransport } from 'winston-elasticsearch';

  const transports: winston.transport[] = [
    // Console (development)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),

    // File (sempre)
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),

    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 30
    })
  ];

  // Production: add Elasticsearch
  if (process.env.NODE_ENV === 'production') {
    transports.push(new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_URL
      }
    }));
  }

  export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.metadata(),
      winston.format.json()
    ),
    defaultMeta: {
      service: 'xcraper-api',
      environment: process.env.NODE_ENV
    },
    transports
  });
  ```

### Request Logging Middleware

- [ ] Criar `backend/src/middleware/requestLogger.ts`
  ```typescript
  import { v4 as uuidv4 } from 'uuid';

  export function requestLogger(req, res, next) {
    req.id = uuidv4();
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;

      logger.info('http_request', {
        requestId: req.id,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
    });

    next();
  }
  ```

- [ ] Registrar no Express antes das rotas

### Structured Logging Examples

- [ ] Em cada endpoint, logar eventos importantes:
  ```typescript
  // Search initiated
  logger.info('search_initiated', {
    requestId: req.id,
    userId: req.user.id,
    query: req.body.query,
    location: req.body.location,
    creditsAvailable: req.user.credits
  });

  // Search completed
  logger.info('search_completed', {
    requestId: req.id,
    userId: req.user.id,
    searchId: search.id,
    totalResults: results.length,
    duration: Date.now() - startTime,
    creditsUsed: 1
  });

  // Errors
  logger.error('search_failed', {
    requestId: req.id,
    userId: req.user.id,
    error: error.message,
    stack: error.stack,
    query: req.body.query
  });
  ```

### Log Levels

- `error`: Erros que exigem ação imediata
- `warn`: Situações anormais mas não críticas
- `info`: Eventos importantes de negócio
- `debug`: Informações detalhadas para debugging
- `verbose`: Logs excessivos (apenas dev)

---

## 📊 2. Metrics e APM

**Estimativa**: 3-4 dias

### Prometheus + Grafana

#### Prometheus Setup

- [ ] Instalar client
  ```bash
  npm install prom-client
  ```

- [ ] Criar `backend/src/utils/metrics.ts`
  ```typescript
  import client from 'prom-client';

  // Registrar métricas padrão (CPU, memória, etc)
  client.collectDefaultMetrics({ timeout: 5000 });

  // Métricas customizadas
  export const metrics = {
    httpRequestDuration: new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code']
    }),

    searchesTotal: new client.Counter({
      name: 'searches_total',
      help: 'Total number of searches executed',
      labelNames: ['status']
    }),

    creditsBalance: new client.Gauge({
      name: 'user_credits_balance',
      help: 'Current credits balance',
      labelNames: ['user_id']
    }),

    apifyRequestDuration: new client.Histogram({
      name: 'apify_request_duration_seconds',
      help: 'Duration of Apify API requests',
      labelNames: ['status']
    }),

    activeUsers: new client.Gauge({
      name: 'active_users',
      help: 'Number of active users (logged in last 24h)'
    })
  };

  // Endpoint para Prometheus scrape
  export function metricsEndpoint(req, res) {
    res.set('Content-Type', client.register.contentType);
    res.end(client.register.metrics());
  }
  ```

- [ ] Registrar endpoint `GET /metrics`
- [ ] Instrumentar código:
  ```typescript
  // Em middleware
  const end = metrics.httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route?.path, status_code: res.statusCode });
  });

  // Nas buscas
  metrics.searchesTotal.inc({ status: 'success' });
  ```

#### Grafana Dashboards

- [ ] Instalar Grafana (Docker ou cloud)
- [ ] Conectar ao Prometheus
- [ ] Criar dashboards:

**Dashboard 1: Application Health**
- Requests per second
- Average response time
- Error rate
- Active users
- CPU e memória

**Dashboard 2: Business Metrics**
- Searches per hour/day
- Credits purchased vs used
- Top queries
- Conversion rate (searches → contacts saved)
- Revenue per day

**Dashboard 3: Apify Performance**
- Apify request duration
- Apify success rate
- Queue size (searches pendentes)

- [ ] Configurar alertas no Grafana

---

## 🚨 3. Error Tracking (Sentry)

**Estimativa**: 1 dia (já mencionado no médio prazo)

### Advanced Sentry Config

- [ ] Configurar contexto rico:
  ```typescript
  Sentry.setUser({
    id: req.user.id,
    email: req.user.email,
    username: req.user.name
  });

  Sentry.setContext('search', {
    query: req.body.query,
    location: req.body.location,
    credits: req.user.credits
  });
  ```

- [ ] Breadcrumbs customizados:
  ```typescript
  Sentry.addBreadcrumb({
    category: 'search',
    message: 'Apify request initiated',
    level: 'info',
    data: { query, location }
  });
  ```

### Source Maps

- [ ] Gerar source maps em produção
- [ ] Upload para Sentry:
  ```bash
  npx @sentry/cli releases files <release> upload-sourcemaps ./dist
  ```

- [ ] Configurar releases no deploy

### Performance Monitoring

- [ ] Habilitar tracing:
  ```typescript
  const transaction = Sentry.startTransaction({
    name: 'POST /api/search',
    op: 'http.server'
  });

  const span = transaction.startChild({
    op: 'apify.request',
    description: 'Fetch Google Maps data'
  });

  // ... código

  span.finish();
  transaction.finish();
  ```

---

## 🔔 4. Alerting

**Estimativa**: 2-3 dias

### Alert Rules

- [ ] Configurar alerts em Grafana/Prometheus:

**Critical Alerts (PagerDuty, SMS)**
- Error rate > 10% for 5 minutes
- API down (health check failed 3 times)
- Database connection lost
- Disk space > 90%
- Memory usage > 95%

**High Priority (Slack, Email)**
- Error rate > 5% for 10 minutes
- P95 latency > 3 seconds
- Apify failure rate > 20%
- No searches in 1 hour (possível outage)

**Medium Priority (Email)**
- Unusual spike in registrations (possível bot)
- Credits balance < 1000 (para workspace admin)
- Daily revenue 50% below average

### Notification Channels

- [ ] Configurar integrações:
  - Slack webhook
  - Email (SendGrid)
  - PagerDuty (opcional, para on-call)
  - Discord (comunidade interna)

### Alert Fatigue Prevention

- [ ] Agrupar alerts similares (max 1 notificação/5 min)
- [ ] Silence durante manutenção programada
- [ ] Escalate: warn → alert → critical (não alertar tudo no mesmo nível)

---

## 🔍 5. Distributed Tracing

**Estimativa**: 3-4 dias (opcional, para escala)

### OpenTelemetry

- [ ] Instalar SDK
  ```bash
  npm install @opentelemetry/api @opentelemetry/sdk-node
  ```

- [ ] Configurar exporters (Jaeger, Zipkin, ou Tempo)
- [ ] Auto-instrumentação:
  ```typescript
  import { NodeSDK } from '@opentelemetry/sdk-node';
  import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
  import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

  const sdk = new NodeSDK({
    traceExporter: new JaegerExporter(),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
    ]
  });

  sdk.start();
  ```

- [ ] Visualizar traces:
  - Request → Auth Middleware → Database Query → Apify API → Response
  - Identificar gargalos

---

## 📈 6. Real User Monitoring (RUM)

**Estimativa**: 2-3 dias

### Frontend Performance

- [ ] Instalar Sentry RUM ou Google Analytics
- [ ] Capturar métricas:
  - Page load time
  - Time to Interactive (TTI)
  - First Contentful Paint (FCP)
  - Largest Contentful Paint (LCP)
  - Cumulative Layout Shift (CLS)

- [ ] Custom events:
  ```typescript
  // Search button clicked
  analytics.track('search_initiated', {
    query: searchQuery,
    hasFilters: Object.keys(filters).length > 0
  });

  // Contact saved
  analytics.track('contact_saved', {
    source: 'search_results'
  });
  ```

### User Behavior Analytics

- [ ] Funnels:
  - Landing → Signup → First Search → First Contact → Purchase

- [ ] Heatmaps (Hotjar, Microsoft Clarity)
  - Onde usuários clicam
  - Scroll depth
  - Session recordings (privacidade: não gravar dados sensíveis)

---

## 🗄️ 7. Database Monitoring

**Estimativa**: 2 dias

### Query Performance

- [ ] Habilitar `pg_stat_statements`
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
  ```

- [ ] Query para slow queries:
  ```sql
  SELECT
    query,
    calls,
    total_time,
    mean_time,
    max_time
  FROM pg_stat_statements
  ORDER BY mean_time DESC
  LIMIT 20;
  ```

- [ ] Dashboard com queries mais lentas
- [ ] Alert se query > 1 segundo

### Connection Pool

- [ ] Monitorar pool size
  ```typescript
  const pool = new Pool({ max: 20 });

  setInterval(() => {
    metrics.dbConnectionsTotal.set(pool.totalCount);
    metrics.dbConnectionsIdle.set(pool.idleCount);
    metrics.dbConnectionsActive.set(pool.totalCount - pool.idleCount);
  }, 10000);
  ```

### Index Usage

- [ ] Query para indexes não utilizados:
  ```sql
  SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan
  FROM pg_stat_user_indexes
  WHERE idx_scan = 0
  ORDER BY tablename;
  ```

- [ ] Remover indexes desnecessários (economia de espaço/write speed)

---

## 📱 8. Uptime Monitoring

**Estimativa**: 1 dia

### External Monitoring

- [ ] Configurar UptimeRobot ou Pingdom
- [ ] Monitorar:
  - Homepage (GET https://xcraper.com)
  - API Health (GET https://api.xcraper.com/health)
  - Login page (verificar se carrega)

- [ ] Intervals: 5 minutos
- [ ] Locations: múltiplas regiões (US, EU, Asia)

### Status Page

- [ ] Criar status.xcraper.com
- [ ] Opções:
  - Statuspage.io (pago)
  - Cachet (open source)
  - Custom (HTML estático + API)

- [ ] Mostrar:
  - API status (operational, degraded, down)
  - Apify integration status
  - Database status
  - Incident history

- [ ] Subscribe para notificações de incident

---

## 🧪 9. Synthetic Monitoring

**Estimativa**: 2-3 dias

### Automated User Flows

- [ ] Scripts que simulam usuário real:
  ```typescript
  // Playwright script
  test('complete search flow', async ({ page }) => {
    await page.goto('https://xcraper.com');
    await page.click('text=Login');
    await page.fill('[name=email]', 'test@example.com');
    await page.fill('[name=password]', 'password');
    await page.click('button:has-text("Login")');

    await expect(page).toHaveURL('/dashboard');

    await page.fill('[name=query]', 'pizza restaurants');
    await page.fill('[name=location]', 'New York');
    await page.click('button:has-text("Search")');

    await expect(page.locator('.search-results')).toBeVisible();
  });
  ```

- [ ] Rodar a cada 15 minutos (DataDog Synthetics, Checkly)
- [ ] Alert se falhar

---

## ✅ Checklist de Observabilidade Completa

- [ ] ✅ Logs estruturados em 100% dos endpoints
- [ ] ✅ Métricas de negócio exportadas (Prometheus)
- [ ] ✅ Dashboards Grafana criados e úteis
- [ ] ✅ Sentry capturando erros com contexto rico
- [ ] ✅ Alertas configurados (critical, high, medium)
- [ ] ✅ Database queries monitoradas
- [ ] ✅ Uptime monitoring ativo
- [ ] ✅ Status page público
- [ ] ✅ Frontend RUM implementado
- [ ] ✅ Synthetic tests passando

---

**Anterior**: [04-seguranca.md](04-seguranca.md)
**Próximo**: [06-compliance.md](06-compliance.md)
