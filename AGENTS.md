# XCraper - AI Agent Development Guide

This document provides comprehensive context for AI agents (like Claude, GPT-4, etc.) working on the XCraper codebase.

## Project Overview

**XCraper** is a multi-user SaaS platform for scraping business contacts from Google Maps using Apify as the scraping engine. The system features a credit-based billing model, dynamic SEO/landing page configuration, and Supabase authentication.

### Business Model
- Credit-based billing system
- 1 credit per search + 1 credit per contact saved
- Configurable pricing packages
- Free credits on signup (configurable)

### Target Users
- Sales teams looking for leads
- Marketing agencies
- B2B lead generation professionals
- Business development teams

## Tech Stack

### Frontend (`/frontend`)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query v5
- **UI Components**: shadcn/ui + Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables
- **Animations**: Framer Motion
- **Authentication**: Supabase Auth (email/password, Google OAuth, GitHub OAuth)

### Backend (`/backend`)
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Supabase JWT token verification
- **Validation**: Zod schemas
- **Scraping**: Apify Client (compass/google-maps-scraper actor)
- **Security**: Helmet, CORS, rate limiting

## Project Structure

```
xcraper/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── index.ts          # Drizzle connection
│   │   │   └── schema.ts         # All database tables
│   │   ├── middleware/
│   │   │   └── auth.ts           # Supabase token verification
│   │   ├── routes/
│   │   │   ├── auth.ts           # User sync, verification
│   │   │   ├── contacts.ts       # CRUD for saved contacts
│   │   │   ├── credits.ts        # Balance, packages, transactions
│   │   │   ├── search.ts         # Apify search integration
│   │   │   ├── settings.ts       # Admin config management
│   │   │   └── users.ts          # User management
│   │   ├── services/
│   │   │   └── apify.ts          # Google Maps scraper service
│   │   ├── scripts/
│   │   │   └── seed-settings.ts  # Default data seeder
│   │   └── index.ts              # Express app entry
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/ui/        # shadcn/ui components
│   │   ├── hooks/
│   │   │   ├── useAuth.tsx       # Supabase auth context
│   │   │   └── use-toast.ts      # Toast notifications
│   │   ├── lib/
│   │   │   ├── api.ts            # Fetch wrapper with auth
│   │   │   ├── supabase.ts       # Supabase client
│   │   │   └── utils.ts          # Utility functions
│   │   ├── pages/
│   │   │   ├── AdminSettingsPage.tsx
│   │   │   ├── AuthCallbackPage.tsx
│   │   │   ├── AuthPage.tsx
│   │   │   ├── ContactsPage.tsx
│   │   │   ├── CreditsPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   └── LandingPage.tsx
│   │   ├── App.tsx               # Routes and providers
│   │   ├── main.tsx              # React entry point
│   │   └── index.css             # Tailwind imports
│   └── package.json
└── README.md
```

## Database Schema

### Tables

#### `users`
```typescript
{
  id: string;           // Supabase user ID
  email: string;        // User email
  name: string;         // Display name
  role: 'user' | 'admin';
  credits: number;      // Current balance
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### `contacts`
```typescript
{
  id: string;
  userId: string;       // FK to users
  placeId?: string;     // Google Places ID
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
  latitude?: number;
  longitude?: number;
  openingHours?: jsonb;
  rawData?: jsonb;      // Full Apify response
  createdAt: Date;
}
```

#### `credit_transactions`
```typescript
{
  id: string;
  userId: string;
  amount: number;       // Positive = purchase, Negative = usage
  type: 'purchase' | 'search' | 'contact_save' | 'admin_adjustment';
  description?: string;
  createdAt: Date;
}
```

#### `search_history`
```typescript
{
  id: string;
  userId: string;
  query: string;
  location: string;
  resultsCount: number;
  creditsUsed: number;
  createdAt: Date;
}
```

#### `settings`
```typescript
{
  id: string;
  // Branding
  brandName: string;
  brandTagline: string;
  brandDescription: string;
  logoUrl?: string;
  faviconUrl?: string;
  // SEO
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  ogImageUrl?: string;
  twitterHandle?: string;
  // Landing Page Content
  heroTitle: string;
  heroSubtitle: string;
  heroCtaText: string;
  featuresTitle: string;
  featuresSubtitle: string;
  pricingTitle: string;
  pricingSubtitle: string;
  faqTitle: string;
  faqContent: jsonb;      // Array of {question, answer}
  testimonialsEnabled: boolean;
  testimonialsContent: jsonb;
  footerText: string;
  footerLinks: jsonb;
  socialLinks: jsonb;
  // Feature Flags
  registrationEnabled: boolean;
  freeCreditsOnSignup: number;
  // Contact Info
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  // Custom Code
  googleAnalyticsId?: string;
  customHeadCode?: string;
  customBodyCode?: string;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

#### `credit_packages`
```typescript
{
  id: string;
  name: string;
  credits: number;
  price: string;         // Decimal as string
  description?: string;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /me | Bearer token | Get current user |
| POST | /sync | Bearer token | Create/sync user in DB |
| GET | /verify | Bearer token | Verify token validity |
| GET | /admin/users | Admin | List all users |

### Search (`/api/search`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | / | Required | Execute Google Maps search |
| GET | /history | Required | Get user's search history |
| GET | /:id | Required | Get specific search |

### Contacts (`/api/contacts`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | / | Required | List user's contacts |
| POST | / | Required | Save a contact |
| DELETE | /:id | Required | Delete a contact |
| POST | /export | Required | Export to CSV/JSON |

### Credits (`/api/credits`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /balance | Required | Get credit balance |
| GET | /packages | Public | List credit packages |
| POST | /purchase | Required | Purchase credits |
| GET | /transactions | Required | Transaction history |
| GET | /admin/transactions | Admin | All transactions |

### Settings (`/api/settings`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /public | Public | Landing page settings |
| GET | / | Admin | All settings |
| PATCH | / | Admin | Update settings |
| POST | /packages | Admin | Create credit package |
| PATCH | /packages/:id | Admin | Update package |
| DELETE | /packages/:id | Admin | Delete package |

## Authentication Flow

1. User authenticates via Supabase (email/password or OAuth)
2. Supabase returns JWT token
3. Frontend stores token in Supabase client (auto-handled)
4. Frontend sends token in `Authorization: Bearer <token>` header
5. Backend middleware verifies token with Supabase
6. Backend syncs user to local database if needed
7. Request proceeds with `req.user` populated

## Environment Variables

### Backend
```env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
APIFY_API_TOKEN=xxx
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
CREDITS_PER_SEARCH=1
CREDITS_PER_CONTACT=1
```

### Frontend
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:3001
```

## Common Tasks

### Adding a New API Endpoint

1. Create route handler in `backend/src/routes/`
2. Add validation with Zod
3. Use `requireAuth` or `requireAdmin` middleware
4. Register route in `backend/src/index.ts`
5. Add frontend API call in `frontend/src/lib/api.ts`
6. Create React Query hook if needed

### Adding a New Page

1. Create component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Use appropriate route wrapper (`ProtectedRoute`, `AdminRoute`, `PublicRoute`)

### Modifying Database Schema

1. Update `backend/src/db/schema.ts`
2. Run `npm run db:generate` to create migration
3. Run `npm run db:push` to apply changes
4. Update related API endpoints and types

### Adding New Settings

1. Add column to `settings` table in schema
2. Update `backend/src/routes/settings.ts` to include new field
3. Update `frontend/src/pages/AdminSettingsPage.tsx` with form field
4. Update `frontend/src/pages/LandingPage.tsx` if public-facing
5. Update seed script if needed

## Code Conventions

### TypeScript
- Strict mode enabled
- Use type inference where possible
- Explicit return types for exported functions
- Avoid `any` - use `unknown` with type guards

### React
- Functional components with hooks
- Props interfaces defined above components
- Use `useAuth` hook for authentication state
- React Query for server state

### Styling
- Tailwind utility classes
- shadcn/ui components for consistency
- CSS variables for theming
- Responsive design (mobile-first)

### API Responses
- Consistent structure: `{ data }` or `{ error, message }`
- HTTP status codes appropriately
- Validation errors include details

## Error Handling

### Frontend
- Toast notifications for user feedback
- Error boundaries for crash recovery
- API errors caught and displayed

### Backend
- Try-catch in route handlers
- Zod validation errors returned with details
- Console logging for debugging
- HTTP status codes: 400, 401, 403, 404, 500

## Security Considerations

- Supabase handles password hashing
- JWT tokens expire (configured in Supabase)
- Service role key never exposed to frontend
- CORS configured for specific origin
- Rate limiting on API endpoints
- Input validation on all endpoints

## Testing Strategy

(To be implemented)
- Backend: Jest + Supertest
- Frontend: Vitest + React Testing Library
- E2E: Playwright

## Deployment

1. Build frontend: `cd frontend && npm run build`
2. Build backend: `cd backend && npm run build`
3. Serve frontend static files
4. Run backend with `npm start`
5. Configure production environment variables

## Known Issues / TODOs

- [ ] Payment integration (Stripe)
- [ ] Email notifications
- [ ] Contact export scheduling
- [ ] Advanced search filters
- [ ] Team/organization support
- [ ] API rate limiting per user
- [ ] Webhook integrations
- [ ] Audit logging

## When Making Changes

1. **Understand the context** - Read related files before modifying
2. **Maintain consistency** - Follow existing patterns
3. **Update types** - Keep TypeScript types in sync
4. **Test auth flows** - Ensure auth still works after changes
5. **Check admin panel** - Settings changes should reflect in admin
6. **Document API changes** - Update this file if adding endpoints

## Questions to Ask

When in doubt, ask:
- What user role is this for? (user, admin, public)
- Should this cost credits?
- Is this a protected or public endpoint?
- Does this need to be configurable in admin settings?
- Should this be added to the landing page?
