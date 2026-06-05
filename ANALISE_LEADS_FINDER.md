# Analise Profunda: Apify Actor - Leads Finder (IoSHqwTR9YGhzccez)

## 1. Visao Geral

**Nome:** Leads Finder  
**ID:** IoSHqwTR9YGhzccez  
**Autor:** code_crafter  
**Categoria:** LEAD_GENERATION  
**Posicionamento:** "Alternativa acessivel ao ZoomInfo, Lusha e Apollo"  
**Preco:** $1.5 por 1.000 leads com emails  
**Build Atual:** 0.0.52 (ktZqlc9dcdoLca0yt)  
**Codigo Fonte:** Oculto (isSourceCodeHidden: true)  
**Repositorio:** GIT_REPO

---

## 2. Metricas e Performance (Dados Oficiais Apify)

### Estatisticas Gerais
- **Total de Builds:** 53
- **Total de Execucoes:** 1.041.978+ runs
- **Total de Usuarios:** 37.701
- **Usuarios Ativos (7 dias):** 1.342
- **Usuarios Ativos (30 dias):** 4.860
- **Usuarios Ativos (90 dias):** 11.375
- **Reviews:** 273 avaliacoes
- **Rating:** 3.89/5.0
- **Bookmarks:** 897

### Performance dos Runs (Ultimos 30 dias)
| Status | Quantidade | Percentual |
|--------|-----------|------------|
| SUCCEEDED | 179.118 | 97.3% |
| FAILED | 945 | 0.5% |
| ABORTED | 3.375 | 1.8% |
| TIMED-OUT | 547 | 0.3% |
| **TOTAL** | **183.985** | **100%** |

**Taxa de Sucesso:** 97.3% (Excelente)  
**Ultimo Run:** 2026-06-05 18:53:46 UTC

---

## 3. Modelo de Precificacao

### Estrutura de Cobranca (Pay Per Event)

| Evento | Preco | Tipo |
|--------|-------|------|
| Actor Start | $0.02 | One-time |
| Lead Fetched (FREE/BRONZE) | $0.002 | Por lead |
| Lead Fetched (SILVER) | $0.0018 | Por lead |
| Lead Fetched (GOLD/PLATINUM/DIAMOND) | $0.0015 | Por lead |

**Custo Minimo:** $0.50  
**Custo por 1.000 leads (tier mais baixo):** $2.00 + $0.02 start = $2.02  
**Custo por 1.000 leads (tier mais alto):** $1.50 + $0.02 start = $1.52  

### Tiered Pricing (Baseado em volume)
- **FREE/BRONZE:** $0.002/lead
- **SILVER:** $0.0018/lead (10% desconto)
- **GOLD/PLATINUM/DIAMOND:** $0.0015/lead (25% desconto)

**Margem Apify:** 20% (a partir de 28/03/2026)

---

## 4. Schema de Dados de Saida (Dataset)

### Campos do Contato (Pessoa)
| Campo | Tipo | Descricao | Taxa de Preenchimento* |
|-------|------|-----------|----------------------|
| first_name | string | Nome | ~100% |
| last_name | string | Sobrenome | ~100% |
| full_name | string | Nome completo | ~100% |
| email | string | Email corporativo verificado | ~60-70% |
| personal_email | string | Email pessoal | ~30-40% |
| mobile_number | string | Numero de celular | ~20-30% |
| job_title | string | Cargo | ~95% |
| headline | string | Titulo do LinkedIn | ~90% |
| linkedin | string | URL do perfil LinkedIn | ~95% |
| seniority_level | string | Nivel hierarquico | ~85% |
| functional_level | string | Area funcional | ~70% |
| city | string | Cidade da pessoa | ~90% |
| state | string | Estado | ~90% |
| country | string | Pais | ~95% |

### Campos da Empresa
| Campo | Tipo | Descricao |
|-------|------|-----------|
| company_name | string | Nome da empresa | 
| company_website | string | Website |
| company_domain | string | Dominio |
| company_linkedin | string | LinkedIn da empresa |
| company_linkedin_uid | string | ID do LinkedIn |
| industry | string | Industria |
| company_size | number | Tamanho (funcionarios) |
| company_founded_year | string | Ano de fundacao |
| company_phone | string | Telefone corporativo |
| company_street_address | string | Endereco |
| company_full_address | string | Endereco completo |
| company_city | string | Cidade |
| company_state | string | Estado |
| company_country | string | Pais |
| company_postal_code | string | CEP |
| company_description | string | Descricao |
| company_annual_revenue | string | Receita anual (raw) |
| company_annual_revenue_clean | string | Receita formatada (ex: "4.6M") |
| company_total_funding | string | Total de funding |
| company_total_funding_clean | string | Funding formatado |
| company_technologies | string | Stack tecnologico |
| keywords | string | Keywords da empresa |

*Taxas estimadas baseadas na amostra analisada

---

## 5. Capacidades e Filtros

### Filtros de Pessoa (Contact)
- **Job Title:** Titulos especificos (ex: "Head of Marketing", "CMO")
- **Seniority Level:** founder, owner, c_suite, director, partner, vp, head, manager, senior, entry, trainee
- **Functional Level:** sales, marketing, operations, finance, human_resources, c_suite

### Filtros de Localizacao
- **Region:** Continente/Regiao
- **Country:** Pais
- **State:** Estado/Provincia
- **City:** Cidade especifica

### Filtros de Empresa
- **Industry:** Setor industrial
- **Company Size:** Numero de funcionarios (1-10, 11-20, 21-50, 51-100, 101-200, 201-500, 501-1000, 1001-2000, 2001-5000, 5001-10000, 10001-20000, 20001-50000, 50000+)
- **Revenue Bands:** Faixas de receita
- **Funding Stage:** Seed, Angel, Series A-F, Venture Round, Debt Financing
- **Company Technologies:** Stack tecnologico (ex: AWS, Salesforce, HubSpot)

### Funcionalidades Avancadas
- Include/Exclude filtering
- City-only targeting
- LinkedIn enrichment
- Email quality validation
- Mobile number discovery
- Personal email extraction

---

## 6. Casos de Uso Documentados

1. **B2B Prospecting:** Listas para outbound por titulo, senioridade, industria e localizacao
2. **CRM Enrichment:** Leads enriquecidos com emails verificados e perfis LinkedIn
3. **Buyer Personas:** Targeting especifico (ex: lideres de marketing em empresas SaaS)
4. **Tech Hiring:** Pesquisa por stacks tecnologicos especificos
5. **Account Segmentation:** Segmentacao por firmographics (tamanho, receita, funding)
6. **Campanhas Regionais:** Targeting por pais/regiao/cidade

---

## 7. Analise Competitiva

### vs ZoomInfo
| Aspecto | Leads Finder | ZoomInfo |
|---------|-------------|----------|
| Preco/1k leads | $1.50 - $2.00 | $100+ |
| Dados LinkedIn | Sim | Sim |
| Email verification | Sim | Sim |
| Mobile numbers | Sim (limitado) | Sim |
| API/Integracao | Apify | Nativo |
| Cobertura Global | Sim | Sim |

### vs Apollo.io
| Aspecto | Leads Finder | Apollo |
|---------|-------------|--------|
| Preco/1k leads | $1.50 - $2.00 | $5-50 |
| Enriquecimento | LinkedIn + Email | Multi-fonte |
| Interface | API/Console | SaaS completo |
| Sequencias | Nao | Sim |
| CRM Sync | Manual (CSV) | Nativo |

### vs Lusha
| Aspecto | Leads Finder | Lusha |
|---------|-------------|-------|
| Preco/lead | $0.0015-0.002 | $0.10-0.30 |
| Cobertura B2B | Completa | Completa |
| API | Sim (Apify) | Sim |

---

## 8. Aspectos Tecnicos

### Configuracao Padrao
- **Timeout:** 3.000 segundos (50 minutos)
- **Memoria:** 512 MB
- **Max Items:** Ilimitado (configuravel)
- **Max Charge:** Ilimitado (configuravel)

### Requisitos de Input
Baseado na documentacao e amostras:
- jobTitles: array de strings
- seniority: array de strings
- industries: array de strings
- companySize: array de strings
- countries: array de strings
- cities: array de strings
- fundingStages: array de strings
- technologies: array de strings
- maxResults: number

### Rate Limiting
- O actor parece ter limites baseados no tier do usuario
- Runs concorrentes podem ser limitados pela conta Apify

---

## 9. Pontos Fortes

1. **Custo-Beneficio Exceptional:** 50-100x mais barato que concorrentes diretos
2. **Alta Taxa de Sucesso:** 97.3% dos runs completam com sucesso
3. **Dados Enriquecidos:** LinkedIn + email verification + company firmographics
4. **Filtros Granulares:** Segmentacao por seniority, function, tech stack, funding
5. **Escalabilidade:** 1M+ de runs processados com sucesso
6. **Output Estruturado:** JSON limpo pronto para CRM/importacao
7. **Validacao de Email:** Emails verificados reduzem bounce rate

---

## 10. Pontos de Atencao

1. **Email Coverage:** Nem todos os leads tem email (~60-70%)
2. **Mobile Numbers:** Taxa de preenchimento baixa (~20-30%)
3. **Personal Emails:** Disponivel apenas em ~30-40% dos casos
4. **Data Freshness:** Dados baseados em LinkedIn (pode estar desatualizado)
5. **Sem CRM Integration:** Requer exportacao manual ou API customizada
6. **Cold Emails:** Emails corporativos podem ter protecao anti-spam
7. **GDPR/CCPA:** Necessario verificar conformidade para uso na UE/California

---

## 11. Recomendacoes de Uso

### Para Xcraper (Integracao)

1. **Substituir/Criar Template B2B:**
   - Criar scraper template especifico para este actor
   - Mapear todos os campos de output para schema de contacts
   - Adicionar transformacao de seniority_level para valores padronizados

2. **Credit System:**
   - Configurar custo por lead baseado no tier do usuario
   - Sugestao: 2-3 credits/lead (considerando margem)
   - Cobrar start fee separadamente ($0.02 = ~0.5 credit)

3. **UI/UX:**
   - Adicionar filtros como steps no wizard (ja implementado)
   - Mostrar preview de campos disponiveis antes do run
   - Indicar coverage rate estimado por campo

4. **Qualidade:**
   - Implementar validacao de email no backend
   - Adicionar score de qualidade do lead
   - Permitir filtrar por leads com email confirmado apenas

5. **Compliance:**
   - Adicionar disclaimer sobre GDPR/LGPD
   - Implementar opt-out mechanism
   - Documentar fonte dos dados (LinkedIn public profiles)

---

## 12. Conclusao

O **Leads Finder** e um actor extremamente competitivo no mercado B2B lead generation, oferecendo:

- **Preco 50-100x menor** que solucoes enterprise (ZoomInfo, Lusha)
- **Qualidade comparavel** com dados de LinkedIn enrichment
- **Alta confiabilidade** (97.3% success rate)
- **Filtros avancados** para targeting preciso

**Recomendacao:** Integrar como opcao premium no Xcraper, posicionando como "B2B Leads Enriched" com pricing competitivo (2-3 credits/lead).

**Score Geral:** 9.0/10
- Custo-beneficio: 10/10
- Qualidade dos dados: 7.5/10
- Confiabilidade: 9.5/10
- Facilidade de uso: 8/10
- Cobertura global: 8.5/10
