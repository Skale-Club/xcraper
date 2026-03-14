# CLAUDE.md - Xcraper Development Guide

This document provides comprehensive context for AI assistants (Claude, etc.) working on the Xcraper codebase.

## Project Overview

**Xcraper** is a multi-user SaaS platform for scraping business contacts from Google Maps using Apify as the scraping engine. The platform features a credit-based billing system, dynamic SEO/landing page configuration, and Supabase authentication.

### Core Purpose
Extract valuable business leads (phone numbers, emails, addresses, ratings, etc.) from Google Maps to help sales teams, marketing agencies, and lead generation professionals find and contact potential clients.

### Business Model
- **Credit-based billing**: Pay-as-you-go system
- **Search cost**: 1 credit per search execution
- **Contact save cost**: 1 credit per contact saved
- **Example**: Searching "restaurants in NYC" + saving 50 contacts = 51 credits
- **Free credits**: Configurable welcome credits for new signups
- **Packages**: Predefined credit bundles (Starter, Professional, Business, Enterprise)

## Tech Stack

### Frontend (`/frontend`)
- **React 18** with TypeScript (functional components + hooks)
- **Vite** - Build tool and dev server
- **Wouter** - Lightweight client-side routing (~1.2kB)
- **TanStack React Query v5** - Server state management, caching, mutations
- **shadcn/ui + Radix UI** - Accessible component primitives
- **Tailwind CSS** - Utility-first styling with CSS variables
- **Framer Motion** - Smooth animations and transitions
- **Supabase Auth** - Authentication (email/password, Google OAuth, GitHub OAuth)
- **React Hook Form + Zod** - Form validation

### Backend (`/backend`)
- **Express.js** with TypeScript
- **PostgreSQL** - Primary database
- **Drizzle ORM** - Type-safe SQL query builder
- **Supabase** - JWT token verification and user management
- **Apify Client** - Google Maps scraping via compass/google-maps-scraper actor
- **Zod** - Runtime validation schemas
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **Express Rate Limit** - API rate limiting
- **Stripe** - Payment processing (integrated)

## Project Structure

```
xcraper/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── index.ts              # Drizzle connection setup
│   │   │   └── schema.ts             # All database tables & relations
│   │   ├── middleware/
│   │   │   └── auth.ts               # Supabase JWT verification
│   │   ├── routes/
│   │   │   ├── auth.ts               # User sync, profile, admin users
│   │   │   ├── contacts.ts           # Contact CRUD & export
│   │   │   ├── credits.ts            # Balance, packages, transactions
│   │   │   ├── search.ts             # Apify search integration
│   │   │   ├── settings.ts           # Admin configuration
│   │   │   └── users.ts              # User management
│   │   ├── services/
│   │   │   └── apify.ts              # Google Maps scraper wrapper
│   │   ├── scripts/
│   │   │   └── seed-settings.ts      # Initial settings & packages
│   │   └── index.ts                  # Express app entry point
│   ├── drizzle/                      # Generated migrations
│   ├── drizzle.config.ts             # Drizzle Kit configuration
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/                   # shadcn/ui components
│   │   ├── hooks/
│   │   │   ├── useAuth.tsx           # Supabase auth context & hooks
│   │   │   └── use-toast.ts          # Toast notification system
│   │   ├── lib/
│   │   │   ├── api.ts                # API client with auth headers
│   │   │   ├── supabase.ts           # Supabase client configuration
│   │   │   └── utils.ts              # Utility functions (cn, etc.)
│   │   ├── pages/
│   │   │   ├── AdminSettingsPage.tsx # Admin panel for all settings
│   │   │   ├── AuthCallbackPage.tsx  # OAuth callback handler
│   │   │   ├── AuthPage.tsx          # Login/signup forms
│   │   │   ├── ContactsPage.tsx      # Saved contacts list & export
│   │   │   ├── CreditsPage.tsx       # Credit packages & purchase
│   │   │   ├── DashboardPage.tsx     # Search interface & history
│   │   │   └── LandingPage.tsx       # Public homepage (dynamic)
│   │   ├── App.tsx                   # Route definitions & providers
│   │   ├── main.tsx                  # React entry point
│   │   └── index.css                 # Tailwind directives & globals
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── tsconfig.json
├── package.json                      # Root workspace configuration
├── README.md                         # User documentation
├── AGENTS.md                         # Agent development guide
└── CLAUDE.md                         # This file
```

## Database Schema

### Core Tables

#### `users`
Primary user accounts synchronized with Supabase Auth.

```typescript
{
  id: uuid;                    // Primary key (auto-generated)
  email: string;               // Unique email address
  name: string;                // Display name
  role: 'user' | 'admin';      // Authorization level
  credits: number;             // Current credit balance
  isActive: boolean;           // Account status
  onboardingCompleted: boolean; // Onboarding flow status
  onboardingStep: number;      // Current step (0-N)
  company?: string;            // Optional company name
  phone?: string;              // Optional phone number
  avatarUrl?: string;          // Profile picture URL
  createdAt: timestamp;
  updatedAt: timestamp;
}
```

**Relations**: Has many `searchHistory`, `contacts`, `creditTransactions`

#### `search_history`
Tracks all Google Maps searches executed by users.

```typescript
{
  id: uuid;
  userId: uuid;                // FK to users
  query: string;               // Search term (e.g., "pizza restaurants")
  location: string;            // Location (e.g., "New York, NY")
  status: string;              // 'pending' | 'running' | 'completed' | 'failed'
  apifyRunId?: string;         // Apify execution ID for tracking
  creditsUsed: number;         // Credits charged for this search
  totalResults: number;        // Number of results returned
  createdAt: timestamp;
  completedAt?: timestamp;     // When search finished
}
```

**Relations**: Belongs to `users`, has many `contacts`

#### `contacts`
Scraped business contact information from Google Maps.

```typescript
{
  id: uuid;
  searchId: uuid;              // FK to search_history
  userId: uuid;                // FK to users (for quick queries)
  title: string;               // Business name
  category?: string;           // Business type/industry
  address?: string;            // Full street address
  phone?: string;              // Phone number
  website?: string;            // Website URL
  email?: string;              // Email address (if available)
  rating?: decimal;            // Star rating (0-5)
  reviewCount?: number;        // Number of reviews
  latitude?: decimal;          // GPS coordinates
  longitude?: decimal;
  openingHours?: string;       // Business hours text
  imageUrl?: string;           // Main photo URL
  googleMapsUrl?: string;      // Google Maps listing URL
  rawData?: jsonb;             // Full Apify response data
  isFavorite: boolean;         // User-marked favorite
  createdAt: timestamp;
}
```

**Relations**: Belongs to `users` and `searchHistory`

#### `credit_transactions`
Complete audit log of all credit movements.

```typescript
{
  id: uuid;
  userId: uuid;                // FK to users
  amount: number;              // Positive = add, Negative = deduct
  type: string;                // 'purchase' | 'usage' | 'refund' | 'bonus'
  description?: string;        // Human-readable explanation
  searchId?: uuid;             // FK if related to a search
  createdAt: timestamp;
}
```

**Relations**: Belongs to `users`, optionally to `searchHistory`

#### `settings`
Single-row configuration table for the entire platform.

```typescript
{
  id: string;                  // Always 'default' (singleton)

  // Branding
  brandName: string;           // "Xcraper"
  brandTagline: string;
  brandDescription: string;
  logoUrl?: string;
  faviconUrl?: string;

  // SEO
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  ogImageUrl?: string;         // Open Graph image
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
  faqContent: jsonb;           // Array of {question, answer}
  testimonialsEnabled: boolean;
  testimonialsContent: jsonb;  // Array of testimonials

  // Footer
  footerText: string;
  footerLinks: jsonb;          // Array of {label, url}
  socialLinks: jsonb;          // Array of {platform, url}

  // Contact Info
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;

  // Custom Code
  googleAnalyticsId?: string;
  customHeadCode?: string;     // Injected into <head>
  customBodyCode?: string;     // Injected before </body>

  // Feature Flags
  registrationEnabled: boolean;
  freeCreditsOnSignup: number;

  createdAt: timestamp;
  updatedAt: timestamp;
}
```

#### `credit_packages`
Predefined credit bundles for purchase.

```typescript
{
  id: uuid;
  name: string;                // "Starter", "Professional", etc.
  credits: number;             // Number of credits in package
  price: decimal;              // Price in USD
  description?: string;        // Marketing copy
  isPopular: boolean;          // Highlight badge
  isActive: boolean;           // Show/hide package
  sortOrder: number;           // Display order
  createdAt: timestamp;
  updatedAt: timestamp;
}
```

#### `session`
Express session storage (managed by connect-pg-simple).

```typescript
{
  sid: string;                 // Session ID (primary key)
  sess: string;                // Serialized session data
  expire: timestamp;           // Expiration time
}
```

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/me` | Bearer token | Get current authenticated user |
| POST | `/sync` | Bearer token | Create/update user in database from Supabase |
| GET | `/verify` | Bearer token | Verify JWT token validity |
| GET | `/admin/users` | Admin | List all users (admin only) |
| PATCH | `/admin/users/:id` | Admin | Update user role/credits |

### Search (`/api/search`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | Required | Execute Google Maps search via Apify |
| GET | `/history` | Required | Get user's search history |
| GET | `/:id` | Required | Get specific search details |
| GET | `/:id/results` | Required | Get contacts from a search |

**POST `/` Request Body:**
```json
{
  "query": "pizza restaurants",
  "location": "New York, NY",
  "maxResults": 50  // Optional, default 20
}
```

### Contacts (`/api/contacts`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Required | List user's saved contacts (paginated) |
| POST | `/` | Required | Save contact (deducts 1 credit) |
| DELETE | `/:id` | Required | Delete a contact |
| PATCH | `/:id/favorite` | Required | Toggle favorite status |
| POST | `/export` | Required | Export contacts (CSV/JSON) |

**Export formats**: `csv`, `json`

### Credits (`/api/credits`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/balance` | Required | Get current credit balance |
| GET | `/packages` | Public | List available credit packages |
| POST | `/purchase` | Required | Purchase credits (Stripe integration) |
| GET | `/transactions` | Required | User's transaction history |
| GET | `/admin/transactions` | Admin | All transactions (admin only) |

### Settings (`/api/settings`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/public` | Public | Get landing page settings (for SEO/content) |
| GET | `/` | Admin | Get all settings (admin only) |
| PATCH | `/` | Admin | Update settings (admin only) |
| POST | `/packages` | Admin | Create new credit package |
| PATCH | `/packages/:id` | Admin | Update credit package |
| DELETE | `/packages/:id` | Admin | Delete credit package |

## Authentication Flow

### User Registration/Login
1. **Frontend**: User submits credentials via Supabase Auth
2. **Supabase**: Creates user account and returns JWT token
3. **Frontend**: Calls `POST /api/auth/sync` with JWT in Authorization header
4. **Backend**: Verifies JWT with Supabase, creates/updates user in local DB
5. **Backend**: Returns user object with credits, role, etc.
6. **Frontend**: Stores user in auth context, redirects to dashboard

### Protected Requests
1. **Frontend**: Includes `Authorization: Bearer <jwt>` header in all API calls
2. **Backend Middleware**: Extracts and verifies JWT with Supabase
3. **Backend Middleware**: Fetches user from local DB, attaches to `req.user`
4. **Route Handler**: Accesses `req.user` for user-specific operations

### Admin Protection
- Additional middleware checks `req.user.role === 'admin'`
- Returns 403 Forbidden if user is not admin
- Used for settings management, user administration, etc.

## Credit System Logic

### Search Flow
1. User initiates search from dashboard
2. Backend checks if user has sufficient credits (minimum 1)
3. If yes, deduct 1 credit and create transaction record
4. Call Apify API with search parameters
5. Store search in `search_history` with status 'running'
6. Poll Apify for results (or use webhook)
7. When complete, store contacts in `contacts` table
8. Update search status to 'completed'

### Contact Save Flow
1. User clicks "Save" on a contact from search results
2. Backend checks if user has sufficient credits (1 credit)
3. Deduct 1 credit, create transaction record
4. Insert contact into `contacts` table
5. Return updated credit balance

### Credit Purchase Flow
1. User selects package from pricing page
2. Frontend redirects to Stripe Checkout
3. Stripe processes payment
4. Webhook triggers credit addition
5. Backend adds credits to user account
6. Creates transaction record with type 'purchase'

## Environment Variables

### Backend (`.env` in `/backend`)
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/xcraper

# Supabase (Authentication)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Apify (Scraping)
APIFY_API_TOKEN=apify_api_xxxxxxxxxxxxx

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Credits Configuration
CREDITS_PER_SEARCH=1
CREDITS_PER_CONTACT=1

# Stripe (Payments)
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### Frontend (`.env` in `/frontend`)
```env
# Supabase (Authentication)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API URL
VITE_API_URL=http://localhost:3001
```

## Common Development Tasks

### Adding a New API Endpoint

1. **Create route handler** in `backend/src/routes/`
2. **Add validation** using Zod schemas
3. **Use middleware**: `requireAuth` for protected routes, `requireAdmin` for admin-only
4. **Register route** in `backend/src/index.ts`
5. **Add API call** in `frontend/src/lib/api.ts`
6. **Create React Query hook** (optional) for data fetching

**Example:**
```typescript
// backend/src/routes/example.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const exampleSchema = z.object({
  name: z.string().min(1),
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name } = exampleSchema.parse(req.body);
    // Logic here
    res.json({ data: { name } });
  } catch (error) {
    res.status(400).json({ error: 'Validation failed' });
  }
});

export default router;
```

### Adding a New Frontend Page

1. **Create component** in `frontend/src/pages/`
2. **Add route** in `frontend/src/App.tsx`
3. **Use route wrapper**: `ProtectedRoute`, `AdminRoute`, or `PublicRoute`

**Example:**
```tsx
// App.tsx
<ProtectedRoute path="/example">
  <ExamplePage />
</ProtectedRoute>
```

### Modifying Database Schema

1. **Update** `backend/src/db/schema.ts`
2. **Generate migration**: `npm run db:generate` (in backend directory)
3. **Apply changes**: `npm run db:push`
4. **Update types**: TypeScript types auto-generated by Drizzle
5. **Update API endpoints** that interact with modified tables
6. **Update seed script** if default data changed

### Adding Admin Settings

1. **Add field** to `settings` table in `backend/src/db/schema.ts`
2. **Run migration**: `npm run db:generate && npm run db:push`
3. **Update** `backend/src/routes/settings.ts` to include new field in PATCH handler
4. **Add form field** in `frontend/src/pages/AdminSettingsPage.tsx`
5. **Update** `frontend/src/pages/LandingPage.tsx` if setting is public-facing
6. **Update seed script** `backend/src/scripts/seed-settings.ts` with default value

## Code Conventions

### TypeScript
- **Strict mode enabled** in all `tsconfig.json` files
- **Type inference preferred** where possible
- **Explicit return types** for exported functions
- **Avoid `any`** - use `unknown` with type guards instead
- **Use interfaces** for object shapes, `type` for unions/intersections

### React
- **Functional components** with hooks only
- **Props interfaces** defined above components
- **Use `useAuth()`** hook for authentication state
- **React Query** for all server state (fetching, mutations, caching)
- **Component composition** over prop drilling

### Styling
- **Tailwind utility classes** for all styling
- **shadcn/ui components** for consistency
- **CSS variables** for theming (see `index.css`)
- **Responsive design**: mobile-first approach
- **Dark mode ready**: Uses CSS variables

### API Design
- **RESTful conventions**: GET, POST, PATCH, DELETE
- **Consistent responses**: `{ data }` for success, `{ error, message }` for errors
- **HTTP status codes**: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Internal Server Error
- **Validation errors** include field-level details from Zod

### File Naming
- **Components**: PascalCase (e.g., `UserProfile.tsx`)
- **Utilities**: camelCase (e.g., `formatDate.ts`)
- **Pages**: PascalCase with "Page" suffix (e.g., `DashboardPage.tsx`)
- **API routes**: kebab-case (e.g., `credit-packages.ts`)

## Error Handling

### Frontend
- **Toast notifications** for user-facing errors
- **Error boundaries** for component crash recovery
- **React Query error handling** for API failures
- **Supabase errors** caught and displayed with user-friendly messages

### Backend
- **Try-catch blocks** in all async route handlers
- **Zod validation** returns detailed error messages
- **Console logging** for debugging (replace with proper logger in production)
- **Graceful degradation**: Return partial data when possible

## Security Best Practices

### Authentication
- **Supabase handles password hashing** - never store plain passwords
- **JWT tokens expire** - configured in Supabase (default 1 hour)
- **Service role key** never exposed to frontend (backend only)
- **Token refresh** handled automatically by Supabase client

### API Security
- **CORS** configured for specific origin (FRONTEND_URL)
- **Helmet** adds security headers (XSS protection, etc.)
- **Rate limiting** on all API endpoints
- **Input validation** with Zod on all endpoints
- **SQL injection protected** by Drizzle parameterized queries

### Data Privacy
- **User isolation**: All queries filtered by `userId`
- **Admin checks**: Role-based access control for sensitive operations
- **HTTPS required** in production
- **Environment variables** for secrets (never commit .env files)

## Testing Strategy

### Backend (To Be Implemented)
- **Unit tests**: Jest for services and utilities
- **Integration tests**: Supertest for API endpoints
- **Database tests**: In-memory PostgreSQL or test database
- **Coverage goal**: 80%+

### Frontend (To Be Implemented)
- **Unit tests**: Vitest for utilities and hooks
- **Component tests**: React Testing Library
- **Integration tests**: Test full user flows
- **E2E tests**: Playwright for critical paths (auth, search, purchase)

## Deployment

### Build Process
```bash
# Backend
cd backend
npm run build          # Compiles TypeScript to dist/

# Frontend
cd frontend
npm run build          # Creates production bundle in dist/
```

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure production `DATABASE_URL`
- [ ] Set production `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Set production `FRONTEND_URL`
- [ ] Configure Stripe production keys
- [ ] Set up SSL/TLS certificates
- [ ] Configure CORS for production domain
- [ ] Enable database backups
- [ ] Set up monitoring and logging
- [ ] Configure rate limiting per environment

### Database Migrations
```bash
cd backend
npm run db:generate    # Generate migration from schema changes
npm run db:migrate     # Apply migrations to production database
```

## Known Issues / Roadmap

### Current Limitations
- Email notifications not implemented
- Stripe webhook verification needs production testing
- No team/organization support yet
- Export limited to 10,000 contacts per request
- Apify rate limits not enforced client-side

### Planned Features
- [ ] Email notifications (welcome, credits low, search complete)
- [ ] Scheduled exports (daily/weekly contact lists)
- [ ] Advanced search filters (rating, review count, category)
- [ ] Team workspaces and shared credits
- [ ] User-level API rate limiting
- [ ] Webhook integrations (Zapier, Make)
- [ ] Audit logging for admin actions
- [ ] Contact deduplication
- [ ] Bulk search (CSV upload)
- [ ] CRM integrations (Salesforce, HubSpot)

## Development Guidelines

### Before Making Changes
1. **Read related files** - Understand context before modifying
2. **Check existing patterns** - Follow established conventions
3. **Update types** - Keep TypeScript types synchronized
4. **Test auth flows** - Ensure authentication still works
5. **Verify admin panel** - Settings changes should reflect in UI
6. **Update documentation** - Keep this file current

### When Adding Features
- **Check if it needs credits** - Should this cost the user?
- **Consider permissions** - Who can access this? (public, user, admin)
- **Think about settings** - Should this be configurable in admin panel?
- **Plan the UI** - Does this need a landing page section?
- **Design for scale** - Will this work with 10,000 users?

### Common Questions to Ask
- What user role is this for? (public, authenticated user, admin)
- Should this action cost credits?
- Is this a protected or public endpoint?
- Does this need to be configurable in admin settings?
- Should this be added to the landing page?
- How will errors be handled and displayed to users?
- What happens if the user runs out of credits?
- Is this data user-specific or global?

## Troubleshooting

### "User not found" errors
- Ensure `POST /api/auth/sync` was called after Supabase login
- Check that JWT token is valid and not expired
- Verify Supabase service role key is correct

### Apify searches failing
- Check `APIFY_API_TOKEN` is valid
- Verify Apify account has sufficient credits
- Check Apify API status (status.apify.com)
- Review search parameters (query, location)

### Database connection issues
- Verify `DATABASE_URL` format is correct
- Ensure PostgreSQL server is running
- Check database user has proper permissions
- Test connection with `psql` or database GUI

### Frontend not connecting to backend
- Verify `VITE_API_URL` matches backend port
- Check CORS configuration in backend
- Ensure backend server is running
- Check browser console for CORS errors

## Resources

### Documentation
- [Drizzle ORM Docs](https://orm.drizzle.team)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Apify API Reference](https://docs.apify.com/api/v2)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [shadcn/ui Components](https://ui.shadcn.com)

### Tools
- [Drizzle Studio](https://orm.drizzle.team/drizzle-studio/overview) - Database GUI (`npm run db:studio`)
- [React Query Devtools](https://tanstack.com/query/latest/docs/react/devtools) - Built into frontend
- [Supabase Dashboard](https://supabase.com/dashboard) - Auth management
- [Apify Console](https://console.apify.com) - Monitor scraping runs

---

**Last Updated**: 2024-03-14
**Maintained By**: Development Team
**Version**: 1.0.0
