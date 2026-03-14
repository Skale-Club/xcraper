# Compliance e Aspectos Legais

Garantir conformidade com regulamentações de proteção de dados e privacidade.

## 🇪🇺 1. GDPR (General Data Protection Regulation)

**Estimativa**: 5-7 dias

### Princípios GDPR

- [ ] Lawfulness, fairness, transparency
- [ ] Purpose limitation
- [ ] Data minimization
- [ ] Accuracy
- [ ] Storage limitation
- [ ] Integrity and confidentiality
- [ ] Accountability

### Rights Implementation

#### Right to Access (Article 15)

- [ ] Endpoint `GET /api/user/data-export`
- [ ] Exportar todos dados do usuário:
  ```json
  {
    "personal_data": {
      "email": "user@example.com",
      "name": "John Doe",
      "phone": "+1234567890",
      "company": "Acme Inc",
      "created_at": "2024-01-01T00:00:00Z"
    },
    "searches": [...],
    "contacts": [...],
    "transactions": [...],
    "audit_logs": [...]
  }
  ```

- [ ] Formato: JSON e PDF
- [ ] Entregar em até 30 dias (GDPR requirement)
- [ ] UI: botão "Download my data" em Settings

#### Right to Rectification (Article 16)

- [ ] Permitir usuário editar:
  - Nome
  - Email (com re-verificação)
  - Telefone
  - Empresa

- [ ] Logar mudanças em audit log

#### Right to Erasure (Article 17)

- [ ] Endpoint `DELETE /api/user/delete-account`
- [ ] Process:
  1. Solicitar confirmação (email)
  2. Período de graça (7 dias para cancelar)
  3. Deletar/Anonimizar dados:
     - Deletar contatos
     - Deletar searches
     - Anonimizar transações (manter para contabilidade)
     - Deletar user ou anonimizar (user_deleted_XXX@anonymized.local)

- [ ] Exceções legais (guardar dados fiscais por 7 anos)

#### Right to Data Portability (Article 20)

✅ Mesmo que Right to Access (export JSON)

#### Right to Object (Article 21)

- [ ] Opt-out de marketing emails
- [ ] Opt-out de analytics tracking
- [ ] UI em Settings: "Privacy Preferences"

### Consent Management

- [ ] Tabela `user_consents`
  ```typescript
  {
    id: uuid;
    userId: uuid;
    consentType: 'tos' | 'privacy' | 'marketing' | 'analytics';
    version: string; // Version of ToS/Privacy when accepted
    accepted: boolean;
    acceptedAt?: timestamp;
    ipAddress: string;
    userAgent: string;
  }
  ```

- [ ] Migração
- [ ] Registrar consent no signup
- [ ] Re-pedir consent se ToS/Privacy mudar (versioning)

### Data Processing Agreement (DPA)

- [ ] Criar template DPA para clientes B2B
- [ ] Definir:
  - Quem é controller vs processor
  - Tipos de dados processados
  - Medidas de segurança
  - Sub-processors (Apify, Stripe, Supabase)
  - Data breach notification process

- [ ] Disponibilizar para download
- [ ] Assinar digitalmente (DocuSign, HelloSign)

### Data Protection Officer (DPO)

- [ ] Designar DPO (pode ser externo)
- [ ] Publicar contato: dpo@xcraper.com
- [ ] Adicionar na Privacy Policy

### Cookies e Tracking

- [ ] Classificar cookies:
  - **Necessary**: autenticação, sessão
  - **Functional**: preferências de UI
  - **Analytics**: Google Analytics, Sentry
  - **Marketing**: Facebook Pixel, Google Ads (se houver)

- [ ] Cookie banner:
  ```tsx
  <CookieConsent
    location="bottom"
    buttonText="Accept All"
    declineButtonText="Reject Non-Essential"
    enableDeclineButton
    onAccept={() => {
      // Habilitar analytics
      enableGoogleAnalytics();
    }}
    onDecline={() => {
      // Apenas essential cookies
      disableGoogleAnalytics();
    }}
  >
    We use cookies to enhance your experience.
    <a href="/privacy">Learn more</a>
  </CookieConsent>
  ```

- [ ] Respeitar DNT (Do Not Track) header

### Breach Notification

- [ ] Processo documentado:
  1. Detectar breach (via security monitoring)
  2. Notificar DPO imediatamente
  3. Investigar escopo (quais dados, quantos usuários)
  4. Notificar autoridade (72 horas)
  5. Notificar usuários afetados (email)
  6. Publicar em status page
  7. Remediation plan

- [ ] Template de email de notificação
- [ ] Contact: autoridade local (ex: CNIL na França, ICO no UK)

---

## 🇺🇸 2. CCPA (California Consumer Privacy Act)

**Estimativa**: 2-3 dias

### Applicable se:

- Receita anual > $25M, OU
- Dados de 50k+ consumidores CA, OU
- 50%+ receita vem de vender dados

**Nota**: Xcraper provavelmente não vende dados, então compliance é mais simples.

### Rights Implementation

#### Right to Know

✅ Mesmo que GDPR Right to Access

#### Right to Delete

✅ Mesmo que GDPR Right to Erasure

#### Right to Opt-Out

- [ ] Link "Do Not Sell My Personal Information" no footer
- [ ] Se aplicável (se vender dados a terceiros)
- [ ] Xcraper: provavelmente não aplica

### Disclosures

- [ ] Adicionar seção na Privacy Policy:
  - Categorias de dados coletados
  - Fontes de dados
  - Propósitos de uso
  - Categorias de terceiros com quem compartilhamos
  - Se vendemos dados (resposta: Não)

---

## 🌍 3. Outras Regulamentações

### LGPD (Brasil)

Similar ao GDPR:
- [ ] Privacy Policy em Português
- [ ] Mesmo processo de data export/deletion
- [ ] Designar DPO (Encarregado de Proteção de Dados)

### PIPEDA (Canadá)

- [ ] Consent para coleta de dados
- [ ] Access e correction rights

### POPIA (África do Sul)

- [ ] Similar GDPR

**Estratégia**: Se compliance GDPR estiver OK, outros são mais fáceis.

---

## 💳 4. PCI DSS (Payment Card Industry)

**Estimativa**: 1 dia (validação)

### Delegação ao Stripe

✅ **Xcraper não toca em dados de cartão**

- [ ] Validar que:
  - Não salvamos números de cartão
  - Não salvamos CVV
  - Não loggamos dados de pagamento
  - Usamos Stripe Elements (tokenização client-side)

### SAQ (Self-Assessment Questionnaire)

- [ ] Preencher SAQ A (Merchant using hosted payment page)
- [ ] ~20 perguntas simples
- [ ] Renovar anualmente

### SSL/TLS

- [ ] Certificado válido
- [ ] TLS 1.2+ (não aceitar TLS 1.0/1.1)

---

## 📜 5. Terms of Service

**Estimativa**: 2-3 dias (com advogado)

### Conteúdo

- [ ] **Definições**
  - Serviço
  - Usuário
  - Créditos
  - Dados

- [ ] **Aceitação dos Termos**
  - Ao se cadastrar, usuário aceita
  - Idade mínima (18 anos ou 13+ com consentimento parental)

- [ ] **Descrição do Serviço**
  - O que Xcraper faz
  - Uso de Apify para scraping
  - Limitações técnicas

- [ ] **Sistema de Créditos**
  - 1 crédito = 1 busca
  - 1 crédito = 1 contato salvo
  - Créditos não expiram (ou expiram após X meses?)
  - Não reembolsável (ou reembolsável em 7 dias?)

- [ ] **Uso Aceitável**
  - Não fazer scraping dos dados do Xcraper
  - Não revender dados sem licença
  - Não usar para spam
  - Não usar bots/scripts automatizados (ou apenas via API oficial)
  - Compliance com leis locais

- [ ] **Propriedade Intelectual**
  - Xcraper é proprietário da plataforma
  - Usuário é proprietário dos dados que coleta
  - Licença: usuário pode usar dados comercialmente

- [ ] **Limitação de Responsabilidade**
  - Xcraper não garante 100% accuracy dos dados
  - Dados vêm do Google Maps (fonte terceira)
  - Não responsável por perda de negócios
  - Limite de liability: valor pago nos últimos 12 meses

- [ ] **Rescisão**
  - Usuário pode cancelar a qualquer momento
  - Xcraper pode suspender conta por violação dos termos
  - Processo de suspensão (warning → temporary → permanent)

- [ ] **Mudanças nos Termos**
  - Xcraper pode atualizar ToS
  - Notificar usuários por email 30 dias antes
  - Continuar usando = aceitar novos termos

- [ ] **Lei Aplicável**
  - Jurisdição (ex: Delaware, EUA ou país da empresa)
  - Arbitragem vs court

- [ ] **Contato**
  - Email legal: legal@xcraper.com

### Revisão Legal

- [ ] Contratar advogado especializado (US: $1-3k, BR: R$2-5k)
- [ ] Revisar compliance com leis locais
- [ ] Atualizar anualmente

---

## 🔒 6. Privacy Policy

**Estimativa**: 2-3 dias (com advogado)

### Conteúdo

- [ ] **Dados Coletados**
  - Informação pessoal (nome, email, telefone)
  - Dados de pagamento (via Stripe - não armazenamos)
  - Dados de uso (searches, contacts saved)
  - Cookies e tracking
  - Logs (IP, user agent)

- [ ] **Como Usamos**
  - Fornecer o serviço
  - Processar pagamentos
  - Comunicações (emails transacionais)
  - Melhorar produto (analytics)
  - Marketing (opt-in)

- [ ] **Compartilhamento**
  - Apify (scraping service) - DPA
  - Stripe (payments) - PCI compliant
  - Supabase (autenticação) - DPA
  - Sentry (error tracking) - DPA
  - Google Analytics (analytics) - anonimizado

- [ ] **Dados de Terceiros**
  - Contatos do Google Maps
  - Xcraper é data processor, usuário é controller
  - Usuário responsável por uso ético

- [ ] **Retenção**
  - Dados de conta: enquanto ativa
  - Dados inativos: 365 dias
  - Transações: 7 anos (legal requirement)
  - Logs: 90 dias

- [ ] **Segurança**
  - Encryption in transit (SSL/TLS)
  - Encryption at rest (database)
  - Access controls
  - Regular security audits

- [ ] **Seus Direitos**
  - Acessar dados
  - Corrigir dados
  - Deletar conta
  - Exportar dados
  - Opt-out de marketing
  - Reclamar com autoridade

- [ ] **Cookies**
  - Tipos de cookies usados
  - Como desabilitar

- [ ] **Crianças**
  - Serviço não destinado a <13 anos
  - Se descobrirmos, deletamos dados

- [ ] **Mudanças na Política**
  - Notificação por email
  - Versioning

- [ ] **Contato**
  - Email: privacy@xcraper.com
  - DPO: dpo@xcraper.com

---

## 📧 7. Políticas de Email

### CAN-SPAM Act (EUA)

- [ ] Incluir endereço físico no footer de emails
- [ ] Link de unsubscribe visível
- [ ] Processar unsubscribe em até 10 dias
- [ ] Não vender lista de emails
- [ ] Subject line honesto (não enganoso)

### GDPR Email Marketing

- [ ] Opt-in explícito (não pre-checked)
- [ ] Double opt-in (confirmar por email)
- [ ] Fácil opt-out (1 clique)

### Tipos de Email

**Transacional** (sempre permitido):
- Welcome email
- Password reset
- Purchase confirmation
- Search completed

**Marketing** (requer opt-in):
- Newsletter
- Feature announcements
- Promotional offers

---

## ✅ Checklist de Compliance

### Documentos Legais

- [ ] ✅ Terms of Service publicados
- [ ] ✅ Privacy Policy publicada
- [ ] ✅ Cookie Policy publicada
- [ ] ✅ DPA template disponível (B2B)
- [ ] ✅ Revisão legal feita

### Funcionalidades

- [ ] ✅ Consent tracking implementado
- [ ] ✅ Data export funcionando
- [ ] ✅ Account deletion funcionando
- [ ] ✅ Cookie banner ativo
- [ ] ✅ Email unsubscribe funcionando
- [ ] ✅ DPO designado e publicado

### Processos

- [ ] ✅ Breach notification process documentado
- [ ] ✅ Data retention automatizado
- [ ] ✅ Vendor DPAs assinados (Apify, Stripe, etc)
- [ ] ✅ Security audit schedule (anual)

---

**Anterior**: [05-observabilidade.md](05-observabilidade.md)
**Próximo**: [07-billing-avancado.md](07-billing-avancado.md)
