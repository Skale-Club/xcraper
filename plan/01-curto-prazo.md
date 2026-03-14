# Curto Prazo (1-2 semanas) - Prioridade CRÍTICA

Tarefas essenciais que devem ser implementadas antes de qualquer escala do produto.

## 🧪 1. Implementar Testes Básicos

### Backend - Testes Unitários

**Estimativa**: 3-4 dias

#### Setup
- [ ] Instalar Jest e dependências de teste
  ```bash
  npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
  ```
- [ ] Configurar `jest.config.js`
- [ ] Criar estrutura `backend/src/__tests__/`

#### Testes de Autenticação
- [ ] Teste: JWT válido retorna usuário
- [ ] Teste: JWT inválido retorna 401
- [ ] Teste: JWT expirado retorna 401
- [ ] Teste: Endpoint `/api/auth/sync` cria usuário novo
- [ ] Teste: Endpoint `/api/auth/sync` atualiza usuário existente
- [ ] Teste: Admin access só para role='admin'

#### Testes de Créditos
- [ ] Teste: Deduzir créditos suficientes funciona
- [ ] Teste: Deduzir créditos insuficientes retorna erro
- [ ] Teste: Race condition não permite balance negativo
- [ ] Teste: Transação criada ao deduzir créditos
- [ ] Teste: Purchase adiciona créditos corretamente
- [ ] Teste: Histórico de transações por usuário

#### Testes de Busca
- [ ] Teste: Busca com créditos suficientes inicia
- [ ] Teste: Busca sem créditos retorna erro
- [ ] Teste: Search history criado corretamente
- [ ] Teste: Apify mock retorna resultados
- [ ] Teste: Erro Apify tratado corretamente

#### Testes de Contatos
- [ ] Teste: Salvar contato deduz 1 crédito
- [ ] Teste: Não permitir salvar sem créditos
- [ ] Teste: Listar contatos por userId
- [ ] Teste: Deletar contato próprio
- [ ] Teste: Não deletar contato de outro usuário
- [ ] Teste: Toggle favorite funciona

### Frontend - Testes Básicos

**Estimativa**: 2-3 dias

#### Setup
- [ ] Configurar Vitest
- [ ] Instalar React Testing Library
- [ ] Criar `frontend/src/__tests__/`

#### Testes de Componentes
- [ ] Teste: Login form submete corretamente
- [ ] Teste: Credit balance display formata número
- [ ] Teste: Search form valida inputs
- [ ] Teste: Contact card renderiza dados
- [ ] Teste: Admin settings só visível para admin

#### Testes de Hooks
- [ ] Teste: useAuth retorna user quando autenticado
- [ ] Teste: useAuth redireciona quando não autenticado
- [ ] Teste: API calls incluem Authorization header

---

## 🔐 2. Fixar Race Conditions em Créditos

**Estimativa**: 1 dia

### Implementar Transações Atômicas

- [ ] Criar `backend/src/services/credits.ts`
- [ ] Implementar função `deductCredits` com transaction
  ```typescript
  async function deductCredits(userId: string, amount: number, description: string) {
    return await db.transaction(async (tx) => {
      // Lock pessimista
      const [user] = await tx.select()
        .from(users)
        .where(eq(users.id, userId))
        .for('update');

      if (!user || user.credits < amount) {
        throw new Error('Insufficient credits');
      }

      // Deduzir créditos
      await tx.update(users)
        .set({ credits: user.credits - amount })
        .where(eq(users.id, userId));

      // Registrar transação
      await tx.insert(creditTransactions).values({
        userId,
        amount: -amount,
        type: 'usage',
        description
      });

      return user.credits - amount;
    });
  }
  ```

- [ ] Refatorar `/api/search` para usar `deductCredits`
- [ ] Refatorar `/api/contacts` para usar `deductCredits`
- [ ] Implementar função `addCredits` com transaction
- [ ] Refatorar `/api/credits/purchase` para usar `addCredits`
- [ ] Adicionar testes de concorrência (10 requests simultâneas)

### Validações Adicionais

- [ ] Validar `amount > 0` antes de deduzir
- [ ] Validar `userId` existe antes de operação
- [ ] Adicionar constraint `CHECK (credits >= 0)` no schema
- [ ] Gerar migração e aplicar

---

## 📝 3. Implementar Logger Estruturado

**Estimativa**: 1 dia

### Setup Winston

- [ ] Instalar Winston
  ```bash
  npm install winston
  ```

- [ ] Criar `backend/src/utils/logger.ts`
  ```typescript
  import winston from 'winston';

  export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'xcraper-api' },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }),
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: 'combined.log' })
    ]
  });
  ```

### Substituir console.log

- [ ] Substituir em `src/index.ts`
- [ ] Substituir em `src/routes/search.ts`
- [ ] Substituir em `src/routes/credits.ts`
- [ ] Substituir em `src/routes/auth.ts`
- [ ] Substituir em `src/services/apify.ts`
- [ ] Substituir em todos middleware

### Estruturar Logs

- [ ] Adicionar contexto útil (userId, requestId, etc.)
- [ ] Log de início/fim de requests
- [ ] Log de erros com stack trace
- [ ] Log de métricas (tempo de resposta)

**Exemplo**:
```typescript
logger.info('search_initiated', {
  userId: req.user.id,
  query: req.body.query,
  location: req.body.location,
  requestId: req.id
});

logger.error('search_failed', {
  userId: req.user.id,
  error: error.message,
  stack: error.stack,
  requestId: req.id
});
```

---

## ⚖️ 4. Compliance Legal (ToS, Privacy Policy)

**Estimativa**: 2-3 dias (inclui revisão legal)

### Terms of Service

- [ ] Criar conteúdo em `frontend/src/pages/TermsPage.tsx`
  - [ ] Definição do serviço
  - [ ] Direitos e responsabilidades
  - [ ] Sistema de créditos explicado
  - [ ] Política de reembolso
  - [ ] Limitações de responsabilidade
  - [ ] Lei aplicável e jurisdição

- [ ] Adicionar link no footer (LandingPage, todas páginas)
- [ ] Checkbox de aceite no signup
- [ ] Armazenar timestamp de aceite no DB
  - [ ] Adicionar campo `tosAcceptedAt` em `users` table
  - [ ] Migração

### Privacy Policy

- [ ] Criar conteúdo em `frontend/src/pages/PrivacyPage.tsx`
  - [ ] Dados coletados (email, nome, dados de pagamento)
  - [ ] Dados de terceiros (contatos do Google Maps)
  - [ ] Como usamos os dados
  - [ ] Compartilhamento (Supabase, Apify, Stripe)
  - [ ] Retenção de dados
  - [ ] Direitos GDPR (acesso, portabilidade, exclusão)
  - [ ] Cookies e tracking
  - [ ] Contato do DPO (Data Protection Officer)

- [ ] Adicionar link no footer
- [ ] Checkbox de aceite no signup (separado do ToS)
- [ ] Armazenar timestamp de aceite
  - [ ] Adicionar campo `privacyAcceptedAt` em `users` table
  - [ ] Migração

### Cookie Consent

- [ ] Implementar banner de cookies
- [ ] Permitir opt-out de analytics
- [ ] Armazenar preferências no localStorage

### Data Deletion

- [ ] Endpoint `/api/user/delete-account`
  - [ ] Deletar contatos
  - [ ] Deletar search history
  - [ ] Deletar transações
  - [ ] Anonimizar ou deletar usuário
  - [ ] Cancelar assinaturas ativas

- [ ] UI no settings para solicitar exclusão
- [ ] Email de confirmação antes de deletar

### Data Export (GDPR Article 20)

- [ ] Endpoint `/api/user/export-data`
- [ ] Exportar JSON com:
  - [ ] Dados do perfil
  - [ ] Histórico de buscas
  - [ ] Contatos salvos
  - [ ] Transações de créditos
- [ ] UI no settings para solicitar export

---

## 🔧 5. Code Quality e DX (Developer Experience)

**Estimativa**: 1 dia

### ESLint e Prettier

- [ ] Configurar ESLint no backend
- [ ] Configurar ESLint no frontend
- [ ] Configurar Prettier
- [ ] Adicionar pre-commit hook (husky)
- [ ] Corrigir warnings existentes

### TypeScript Strict Mode

- [ ] Verificar se `strict: true` está ativo
- [ ] Corrigir erros de tipo se existirem
- [ ] Remover `any` types onde possível

### Scripts Úteis

- [ ] Criar `npm run test:watch` (frontend e backend)
- [ ] Criar `npm run lint:fix`
- [ ] Criar `npm run type-check`
- [ ] Atualizar README com comandos

---

## 📊 6. Calcular Margem Real vs Apify

**Estimativa**: 1 dia

### Análise de Custos

- [ ] Documentar pricing do Apify
  - Custo por scrape
  - Custo por resultado
  - Limites de rate

- [ ] Calcular custo médio:
  ```
  Busca média: X resultados
  Custo Apify: $Y por busca
  Receita Xcraper: 1 crédito = $Z
  Margem: (Z - Y) / Z * 100%
  ```

- [ ] Criar planilha de breakeven
- [ ] Definir pricing ideal para 50%+ margem

### Ajustar Pricing se Necessário

- [ ] Atualizar valores de credit packages
- [ ] Comunicar mudanças (se já houver usuários)
- [ ] Implementar grandfathering (usuários antigos mantêm preço)

---

## ✅ Checklist de Conclusão

Antes de marcar curto prazo como completo:

- [ ] ✅ Todos os testes passando
- [ ] ✅ Coverage > 60% no backend
- [ ] ✅ Race conditions eliminadas (teste de carga)
- [ ] ✅ Logger implementado em 100% dos endpoints
- [ ] ✅ ToS e Privacy publicados e aceitos no signup
- [ ] ✅ Margem de lucro validada como saudável (>40%)
- [ ] ✅ Code quality passing (ESLint, TypeScript strict)

---

**Próximo**: [02-medio-prazo.md](02-medio-prazo.md)
