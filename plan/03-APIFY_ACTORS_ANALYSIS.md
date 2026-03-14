# Análise Profunda dos Apify Actors - Xcraper

## Visão Geral

O sistema Xcraper utiliza dois actors diferentes do Apify para realizar scraping do Google Maps, cada um com características e precificação específicas.

---

## Actor 1: Google Maps Scraper (Standard)
**ID**: `nwua9Gu5YrADL7ZDj`
**Nome**: `compass/crawler-google-places`
**Título**: 📍 Google Maps Scraper

### Características
- **Criado**: 2018-11-19
- **Última atualização**: 2026-03-13
- **Total de execuções**: 19,926,261
- **Total de usuários**: 308,839
- **Avaliação**: 4.71/5 (989 reviews)
- **Memória padrão**: 4096 MB
- **Timeout padrão**: 604,800 segundos (7 dias)

### Funcionalidades
- Extração de dados básicos do Google Maps
- Informações de contato (telefone, website)
- Endereços e coordenadas
- Horários de funcionamento
- Avaliações e contagem de reviews
- Imagens
- Preços e menus
- **NÃO inclui extração automática de emails do site**

### Modelo de Precificação (Pay-per-Event)

| Evento | Descrição | Preço (USD) |
|--------|-----------|-------------|
| **Actor start** | Taxa fixa por iniciar uma execução | $0.007 |
| **Place scraped** | Custo por local extraído com sucesso | $0.004 |
| **Filter applied** | Custo adicional por filtro (categoria, estrelas, etc.) | $0.001 |
| **Place details scraped** | Detalhes adicionais (reservas, questões) | $0.002 |
| **Contact details scraped** | Enriquecimento de contatos (redes sociais, email corporativo) | $0.002 |
| **Lead scraped** | Extração de leads (nome completo, email, cargo) | Variável |

### Cálculo de Custo para Xcraper (Standard)
**Exemplo**: 50 lugares sem email
- Actor start: $0.007
- 50 places × $0.004 = $0.200
- **Total**: ~$0.207 por busca de 50 resultados
- **Custo por resultado**: ~$0.004

### Input Parameters (Principais)
```json
{
  "searchString": "restaurantes em São Paulo",
  "maxCrawledPlaces": 50,
  "language": "pt",
  "proxyConfig": {
    "useApifyProxy": true
  },
  "includeWebsites": true,
  "includePhoneNumber": true,
  "includeImages": true,
  "includeOpeningHours": true
}
```

---

## Actor 2: Google Maps Email Extractor (Enriched)
**ID**: `WnMxbsRLNbPeYL6ge`
**Nome**: `lukaskrivka/google-maps-with-contact-details`
**Título**: 📩📍 Google Maps Email Extractor

### Características
- **Criado**: 2023-04-04
- **Última atualização**: 2026-03-13
- **Total de execuções**: 1,444,925
- **Total de usuários**: 61,427
- **Avaliação**: 4.45/5 (166 reviews)
- **Memória padrão**: 1024 MB
- **Timeout padrão**: 3,600,000 segundos (1000 horas)

### Funcionalidades
- **Tudo do Actor 1 MAIS:**
- **Extração automática de emails** visitando os websites
- Redes sociais (Facebook, Instagram, LinkedIn, Twitter, etc.)
- Endereços de email específicos
- Informações de contato aprimoradas
- CEP/Zipcode
- Scraping profundo dos websites

### Modelo de Precificação (Price per Dataset Item)

| Tier | Preço por Resultado (USD) |
|------|---------------------------|
| **FREE** | $0.010 |
| **BRONZE** | $0.009 |
| **SILVER** | $0.008 |
| **GOLD** | $0.007 |
| **PLATINUM** | $0.006 |
| **DIAMOND** | $0.005 |

**Nota**: Preço atual (FREE tier) = $0.009 por resultado com email

### Cálculo de Custo para Xcraper (Enriched)
**Exemplo**: 50 lugares com email
- 50 results × $0.009 = $0.450
- **Total**: $0.450 por busca de 50 resultados
- **Custo por resultado**: $0.009

### Diferença de Custo
- **Standard**: $0.004/resultado
- **Enriched**: $0.009/resultado
- **Diferença**: 2.25x mais caro (125% mais)

### Input Parameters (Principais)
```json
{
  "searchStringsArray": ["restaurantes em São Paulo"],
  "maxItems": 50,
  "language": "pt",
  "countryCode": "BR",
  "extractEmails": true,
  "extractPhones": true,
  "extractWebsites": true,
  "extractSocialMedia": true,
  "extractAddress": true,
  "extractCoordinates": true,
  "extractOpeningHours": true
}
```

---

## Comparação Lado a Lado

| Característica | Standard (nwua9Gu5YrADL7ZDj) | Enriched (WnMxbsRLNbPeYL6ge) |
|----------------|------------------------------|-------------------------------|
| **Email automático** | ❌ Não | ✅ Sim |
| **Scraping de site** | ❌ Não | ✅ Sim |
| **Redes sociais** | ❌ Não | ✅ Sim |
| **Telefone** | ✅ Sim | ✅ Sim |
| **Website** | ✅ Sim | ✅ Sim |
| **Endereço** | ✅ Sim | ✅ Sim |
| **Coordenadas** | ✅ Sim | ✅ Sim |
| **Horários** | ✅ Sim | ✅ Sim |
| **Avaliações** | ✅ Sim | ✅ Sim |
| **Imagens** | ✅ Sim | ✅ Sim |
| **Custo/resultado** | ~$0.004 | ~$0.009 |
| **Velocidade** | ⚡ Mais rápido | 🐢 Mais lento |
| **Memória** | 4096 MB | 1024 MB |

---

## Estratégia de Implementação Xcraper

### Sistema Atual
```typescript
const actorId = params.extractEmails
    ? GOOGLE_MAPS_ACTOR_ENRICHED  // WnMxbsRLNbPeYL6ge
    : GOOGLE_MAPS_ACTOR_STANDARD;  // nwua9Gu5YrADL7ZDj
```

### Modelo de Créditos Recomendado

#### Opção 1: Baseado em Custo Real + Margem
- **Standard**: 1 crédito = $0.01 (margem de 150%)
- **Enriched**: 3 créditos = $0.027 (margem de 200%)

#### Opção 2: Simplificado (Atual)
- **Standard**: 1 crédito por resultado
- **Enriched**: 3 créditos por resultado

**Recomendação**: Manter Opção 2 (simplificado) por ser mais fácil de entender pelos usuários.

---

## Otimizações Necessárias no Código

### 1. Parâmetros Específicos por Actor

**Standard Actor** precisa de:
```typescript
{
  searchString: `${query} ${location}`,  // String única
  maxCrawledPlaces: maxResults,
  proxyConfig: { useApifyProxy: true }
}
```

**Enriched Actor** precisa de:
```typescript
{
  searchStringsArray: [`${query} ${location}`],  // Array de strings
  maxItems: maxResults,
  extractEmails: true,
  extractSocialMedia: true
}
```

### 2. Tratamento de Resultados

**Standard Actor** retorna:
```typescript
{
  title: string,
  address: string,
  phone?: string,
  website?: string,
  // email NÃO está incluído automaticamente
}
```

**Enriched Actor** retorna:
```typescript
{
  title: string,
  address: string,
  phone?: string,
  website?: string,
  email?: string,  // ✅ Incluído
  facebook?: string,
  instagram?: string,
  linkedin?: string,
  twitter?: string
}
```

### 3. Validação de Email

No código atual:
```typescript
function hasValidEmail(email?: string): boolean {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
```

**Importante**: Só cobrar créditos de "enriched" se email foi realmente encontrado:
```typescript
const requestEnrichment = searchRecord.standardResultsCount === null
    && searchRecord.enrichedResultsCount !== null;
const eligibleResults = requestEnrichment
    ? results.filter((result) => hasValidEmail(result.email))
    : results;
```

---

## Recomendações de Atualização

### 1. Criar Configuração Específica por Actor

```typescript
// backend/src/services/apify.ts

const ACTOR_CONFIGS = {
  STANDARD: {
    id: 'nwua9Gu5YrADL7ZDj',
    inputFormat: 'searchString', // String única
    extractsEmails: false,
    costPerResult: 0.004,
    creditsPerResult: 1
  },
  ENRICHED: {
    id: 'WnMxbsRLNbPeYL6ge',
    inputFormat: 'searchStringsArray', // Array de strings
    extractsEmails: true,
    costPerResult: 0.009,
    creditsPerResult: 3
  }
};
```

### 2. Adaptar Input Dinamicamente

```typescript
export async function startScrapingTask(params: SearchParams): Promise<string> {
    const config = params.extractEmails
        ? ACTOR_CONFIGS.ENRICHED
        : ACTOR_CONFIGS.STANDARD;

    const searchString = `${params.search} ${params.location}`.trim();

    // Input específico por actor
    const input = config.inputFormat === 'searchStringsArray'
        ? {
            searchStringsArray: [searchString],
            maxItems: params.maxResults || 50,
            extractEmails: true,
            extractSocialMedia: true,
            extractPhones: true,
            extractWebsites: true,
            extractAddress: true,
            extractCoordinates: true,
            extractOpeningHours: true
          }
        : {
            searchString: searchString,
            maxCrawledPlaces: params.maxResults || 50,
            language: params.language || 'en',
            proxyConfig: { useApifyProxy: true },
            includeWebsites: true,
            includePhoneNumber: true,
            includeImages: true,
            includeOpeningHours: true
          };

    const run = await apifyClient.actor(config.id).call(input);
    console.log(`Started ${config.extractsEmails ? 'ENRICHED' : 'STANDARD'} actor - Run ID: ${run.id}`);
    return run.id;
}
```

### 3. Normalizar Resultados

```typescript
export async function getTaskResults(runId: string): Promise<ScrapedPlace[]> {
    const { items } = await apifyClient.run(runId).dataset().listItems();

    return items.map((item: any) => ({
        title: item.title || item.name || '',
        category: item.categoryName || item.category || '',
        address: item.address || '',
        phone: item.phone || item.phoneNumber || undefined,
        website: item.website || item.url || undefined,
        email: item.email || undefined,  // Pode vir vazio no standard
        rating: item.totalScore || item.rating || undefined,
        reviewCount: item.reviewsCount || item.reviews || undefined,
        latitude: item.location?.lat || item.latitude || undefined,
        longitude: item.location?.lng || item.longitude || undefined,
        // Campos extras do enriched
        facebook: item.facebook || undefined,
        instagram: item.instagram || undefined,
        linkedin: item.linkedin || undefined,
        twitter: item.twitter || undefined,
        rawData: item
    }));
}
```

---

## Considerações de Performance

### Standard Actor
- ⚡ **Mais rápido**: ~10-30 segundos para 50 resultados
- 💾 **Menos memória**: Não precisa visitar websites
- 💰 **Mais barato**: $0.004/resultado

### Enriched Actor
- 🐢 **Mais lento**: ~2-5 minutos para 50 resultados (precisa visitar cada website)
- 💾 **Mais memória**: Scraping adicional de websites
- 💰 **Mais caro**: $0.009/resultado
- ⚠️ **Taxa de sucesso**: ~60-70% (nem todo website tem email)

### Recomendação ao Usuário
Mostrar claramente na UI:
```
[ ] Standard (mais rápido, sem email) - 1 crédito/resultado
[ ] Enriched (mais lento, com email) - 3 créditos/resultado
    ⚠️ Nota: Email encontrado em ~60% dos casos
```

---

## Fontes

- [Google Maps Scraper (compass)](https://apify.com/compass/crawler-google-places)
- [Google Maps Email Extractor (lukaskrivka)](https://apify.com/lukaskrivka/google-maps-with-contact-details)
- [Apify API Documentation](https://docs.apify.com/api/v2)
- Dados obtidos via Apify API em 2026-03-14

---

## Próximos Passos

1. ✅ Configurar dois actors diferentes
2. ⚠️ **Adaptar input parameters** por actor (PENDENTE)
3. ⚠️ **Normalizar outputs** para consistência (PENDENTE)
4. ⚠️ **Atualizar UI** para mostrar diferenças claras (PENDENTE)
5. ⚠️ **Documentar taxa de sucesso** de email extraction (PENDENTE)
6. ⚠️ **Adicionar retry logic** para falhas (PENDENTE)
7. ⚠️ **Implementar caching** de resultados (PENDENTE)
