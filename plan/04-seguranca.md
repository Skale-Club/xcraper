# Checklist de Segurança

Melhorias e validações de segurança para proteger usuários e dados.

## 🔐 1. Autenticação e Autorização

### Two-Factor Authentication (2FA)

**Estimativa**: 3-4 dias

- [ ] Adicionar campo `twoFactorEnabled` em `users`
- [ ] Adicionar campo `twoFactorSecret` (encrypted)
- [ ] Migração

- [ ] Instalar biblioteca TOTP
  ```bash
  npm install otplib qrcode
  ```

- [ ] Endpoints:
  - `POST /api/auth/2fa/setup` - Gerar secret e QR code
  - `POST /api/auth/2fa/verify` - Verificar código
  - `POST /api/auth/2fa/disable` - Desabilitar 2FA
  - `POST /api/auth/login-2fa` - Login com 2FA

- [ ] UI em Settings para habilitar 2FA
- [ ] Mostrar QR code (Google Authenticator, Authy)
- [ ] Recovery codes (10 códigos de backup)
- [ ] Armazenar recovery codes (hashed)

- [ ] Forçar 2FA para admins
- [ ] Email notification quando 2FA habilitado/desabilitado

### Session Management

- [ ] Listar sessões ativas do usuário
- [ ] Endpoint `GET /api/sessions` - Ver dispositivos/locais
- [ ] Endpoint `DELETE /api/sessions/:id` - Revogar sessão
- [ ] Endpoint `DELETE /api/sessions/all` - Logout de todos dispositivos

- [ ] Armazenar metadata de sessão:
  ```typescript
  {
    userId: uuid;
    sessionId: string;
    ipAddress: string;
    userAgent: string;
    location?: string; // IP geolocation
    lastActiveAt: timestamp;
    createdAt: timestamp;
  }
  ```

- [ ] UI em Settings: "Dispositivos conectados"

### Password Policies

- [ ] Validar força de senha (Supabase já faz básico)
- [ ] Adicionar zxcvbn para score de força
- [ ] Bloquear senhas comuns (lista de 10k senhas fracas)
- [ ] Expiração de senha (opcional, 90 dias)
- [ ] Histórico de senhas (não permitir reutilizar últimas 5)

---

## 🛡️ 2. Proteção contra Ataques

### Rate Limiting Avançado

- [ ] Rate limit por IP E por user combinados
- [ ] Aumentar limite gradualmente se usuário confiável
- [ ] Banir IP temporariamente após X falhas de login
- [ ] Whitelist IPs (para APIs corporativas)

### CAPTCHA

**Estimativa**: 1 dia

- [ ] Adicionar hCaptcha ou reCAPTCHA v3
- [ ] Aplicar em:
  - Signup (prevenir bots)
  - Login após 3 falhas
  - Contact form (se houver)

- [ ] Configurar:
  ```env
  CAPTCHA_SITE_KEY=xxx
  CAPTCHA_SECRET_KEY=yyy
  ```

- [ ] Componente React
  ```tsx
  import HCaptcha from '@hcaptcha/react-hcaptcha';

  <HCaptcha
    sitekey={VITE_CAPTCHA_SITE_KEY}
    onVerify={(token) => setCaptchaToken(token)}
  />
  ```

- [ ] Validar token no backend antes de criar conta

### SQL Injection Prevention

✅ **Já implementado** via Drizzle (queries parametrizadas)

- [ ] Auditar qualquer uso de raw SQL
- [ ] Se existir raw SQL, usar prepared statements

### XSS Prevention

- [ ] Sanitizar inputs HTML se permitir rich text
  ```bash
  npm install dompurify
  ```

- [ ] Sanitizar antes de renderizar conteúdo de usuário
- [ ] Content Security Policy headers (via Helmet)
  ```typescript
  app.use(helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  }));
  ```

### CSRF Protection

- [ ] Implementar CSRF tokens (se usar cookies de sessão)
  ```bash
  npm install csurf
  ```

- [ ] Validar em todas mutações (POST, PATCH, DELETE)
- [ ] Supabase JWT já protege parcialmente (stateless)

---

## 🔒 3. Proteção de Dados

### Encryption at Rest

- [ ] Encrypt sensitive fields no database:
  - `users.phone`
  - `contacts.email`
  - `contacts.phone`
  - `api_keys.key` (hash, não encrypt)

- [ ] Usar biblioteca de encryption
  ```bash
  npm install @47ng/cloak
  ```

- [ ] Armazenar encryption key segura (AWS KMS, Vault)
  ```env
  ENCRYPTION_KEY=base64:xxxxx
  ```

- [ ] Funções helper:
  ```typescript
  import { encrypt, decrypt } from './crypto';

  const encryptedPhone = encrypt(phone);
  const originalPhone = decrypt(encryptedPhone);
  ```

### Backup e Recovery

- [ ] Configurar backups automáticos do PostgreSQL
  - Diário (reter 7 dias)
  - Semanal (reter 4 semanas)
  - Mensal (reter 12 meses)

- [ ] Testar restore mensalmente
- [ ] Backup em região diferente (disaster recovery)

### Data Retention Policy

- [ ] Configurar em Settings (admin):
  ```typescript
  {
    deleteInactiveUsersAfterDays: 365;
    deleteSearchHistoryAfterDays: 90;
    deleteContactsAfterDays?: number; // Optional
  }
  ```

- [ ] Cron job para cleanup
- [ ] Notificar usuário antes de deletar (30 dias de aviso)

---

## 🚨 4. Monitoring de Segurança

### Alertas de Atividade Suspeita

- [ ] Login de novo dispositivo/localização → Email
- [ ] Mudança de senha → Email
- [ ] Mudança de email → Email (ambos endereços)
- [ ] 5+ logins falhados → Email + bloquear temporariamente
- [ ] Compra de créditos alta (>$500) → Revisar manualmente

### Audit Log de Segurança

- [ ] Logar eventos sensíveis:
  - Login success/fail
  - Password reset
  - 2FA enabled/disabled
  - Email changed
  - Role changed (user → admin)
  - API key created/revoked
  - Large credit purchase

### Vulnerability Scanning

- [ ] Configurar Dependabot (GitHub)
- [ ] Configurar Snyk
- [ ] `npm audit` no CI/CD pipeline
- [ ] Bloquear deploy se vulnerabilidades HIGH/CRITICAL

---

## 🌐 5. API Security

### Input Validation

✅ **Já implementado** via Zod

- [ ] Validar 100% dos endpoints
- [ ] Sanitizar strings (trim, lowercase quando apropriado)
- [ ] Validar tipos estritamente
- [ ] Limits em tamanhos:
  - `query`: max 200 chars
  - `location`: max 100 chars
  - `email`: max 255 chars

### Output Sanitization

- [ ] Nunca retornar dados sensíveis:
  - `users.password` (nem deve existir no schema)
  - `api_keys.key` (retornar apenas last 4 chars)
  - `credit_transactions` de outros usuários

- [ ] DTO (Data Transfer Objects) para responses
  ```typescript
  function toUserDTO(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      credits: user.credits,
      // Omitir campos internos
    };
  }
  ```

### CORS Strict

- [ ] Produção: apenas domínio específico
  ```typescript
  const corsOptions = {
    origin: process.env.FRONTEND_URL,
    credentials: true
  };
  ```

- [ ] Dev: localhost permitido
- [ ] Documentar em README se precisar adicionar origem

---

## 🔐 6. Infrastructure Security

### HTTPS Enforcement

- [ ] Certificado SSL/TLS válido
- [ ] Redirect HTTP → HTTPS
- [ ] HSTS header:
  ```typescript
  app.use(helmet.hsts({
    maxAge: 31536000, // 1 ano
    includeSubDomains: true,
    preload: true
  }));
  ```

### Environment Variables

- [ ] Nunca commitar `.env` files
- [ ] Usar secrets manager (AWS Secrets Manager, Vault)
- [ ] Rotate secrets regularmente:
  - Database password (90 dias)
  - API keys (180 dias)
  - JWT secret (nunca? ou anualmente)

### Database Security

- [ ] User do database com least privilege
  - Read/Write apenas nas tabelas necessárias
  - Não permitir DROP, ALTER em produção

- [ ] Conexão via SSL
  ```
  DATABASE_URL=postgres://user:pass@host/db?sslmode=require
  ```

- [ ] IP whitelist (apenas servidores da app)

### Server Hardening

- [ ] Firewall: apenas portas 80, 443 abertas
- [ ] Disable directory listing
- [ ] Remove server headers que revelam versão
  ```typescript
  app.disable('x-powered-by');
  ```

- [ ] Logs de acesso (nginx, CloudFlare)

---

## 🧪 7. Security Testing

### Penetration Testing

- [ ] Contratar pentest profissional (anual)
- [ ] Ou usar ferramentas automatizadas:
  - OWASP ZAP
  - Burp Suite

### Security Checklist

- [ ] OWASP Top 10 verificados:
  - [x] A01: Broken Access Control → ✅ Middleware auth
  - [x] A02: Cryptographic Failures → ⚠️ Implementar encryption
  - [x] A03: Injection → ✅ Drizzle ORM
  - [ ] A04: Insecure Design → Revisar arquitetura
  - [ ] A05: Security Misconfiguration → Revisar configs
  - [ ] A06: Vulnerable Components → ✅ npm audit
  - [x] A07: Auth Failures → ✅ Supabase + rate limit
  - [x] A08: Software/Data Integrity → ✅ Validação Zod
  - [ ] A09: Logging Failures → ⚠️ Implementar Winston
  - [x] A10: SSRF → ✅ Não há requests user-controlled

---

## 📋 Compliance Checklist

### GDPR (EU)

- [x] Privacy Policy publicada
- [x] Terms of Service publicados
- [ ] Cookie consent banner
- [x] Right to access (data export) → Implementar
- [x] Right to deletion → Implementar
- [ ] Right to rectification (editar dados)
- [ ] Data Processing Agreement (DPA) para clientes B2B
- [ ] Designar DPO (Data Protection Officer)
- [ ] Breach notification process (72h)

### CCPA (California)

- [ ] "Do Not Sell My Information" link
- [ ] Disclosure de categorias de dados coletados
- [ ] Opt-out de venda de dados (não aplicável se não vendemos)

### PCI DSS (Payment Card)

✅ **Delegado ao Stripe** - Não armazenamos dados de cartão

- [ ] Validar que não salvamos CVV, número completo
- [ ] Usar Stripe Elements (tokens, não raw data)

---

## ✅ Prioridades de Segurança

### Crítico (Fazer Já)
1. [ ] 2FA para admins
2. [ ] CAPTCHA no signup
3. [ ] HTTPS enforcement
4. [ ] Encrypt sensitive fields
5. [ ] Data export/deletion (GDPR)

### Alto (2-4 semanas)
6. [ ] Session management
7. [ ] Security audit logging
8. [ ] Vulnerability scanning automatizado
9. [ ] Password policies
10. [ ] Penetration test

### Médio (1-2 meses)
11. [ ] Data retention automation
12. [ ] Backup testing mensal
13. [ ] IP whitelisting
14. [ ] Advanced rate limiting

---

**Anterior**: [03-longo-prazo.md](03-longo-prazo.md)
**Próximo**: [05-observabilidade.md](05-observabilidade.md)
