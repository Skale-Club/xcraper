# Xcraper - Google Maps Contact Scraper

A powerful multi-user contact scraping tool that extracts business information from Google Maps using Apify as the scraping engine. Built with modern web technologies and designed for scalability.

![Xcraper Banner](https://via.placeholder.com/1200x400/4F46E5/FFFFFF?text=Xcraper+-+Google+Maps+Contact+Scraper)

## 🚀 Features

- **Multi-User Platform**: Each user has their own account, credits, and saved contacts
- **Google Maps Scraping**: Extract business data using Apify's powerful scraping engine
- **Supabase Authentication**: Secure authentication with email/password, Google, and GitHub OAuth
- **Credit-Based Billing**: Flexible pay-as-you-go pricing system
- **Dynamic SEO & Landing Page**: Fully customizable landing page with SEO settings
- **Admin Panel**: Complete control over branding, pricing, and content
- **Contact Management**: Save, organize, and export your leads
- **Real-time Search**: Live search results with instant preview

### Extracted Data

- Business name
- Phone number
- Email address
- Physical address
- Website URL
- Rating and review count
- Opening hours
- Social media links
- Category/industry

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Wouter** for routing
- **TanStack React Query** for server state management
- **shadcn/ui + Radix UI** for UI components
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Supabase Auth** for authentication

### Backend
- **Express.js** with TypeScript
- **Drizzle ORM** with PostgreSQL
- **Supabase Auth** for token verification
- **Zod** for validation
- **Apify Client** for Google Maps scraping

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- Supabase account (free tier works)
- Apify account and API token

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/xcraper.git
cd xcraper
```

### 2. Setup Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down your project URL and anon key from Settings > API
3. Get your service role key from Settings > API (keep this secret!)
4. Enable Google and GitHub OAuth in Authentication > Providers if desired

### 3. Install dependencies

```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 4. Configure environment variables

Create a `.env` file in the `backend` directory:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/xcraper

# Supabase (Required for Authentication)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Apify
APIFY_API_TOKEN=your-apify-api-token

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Credits configuration
CREDITS_PER_SEARCH=1
CREDITS_PER_CONTACT=1
```

Create a `.env` file in the `frontend` directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Backend API URL (optional)
VITE_API_URL=http://localhost:3001
```

### 5. Setup the database

```bash
cd backend

# Generate database schema
npm run db:generate

# Push schema to database
npm run db:push

# Seed default settings
npm run db:seed
```

### 6. Create an admin user

After starting the server, register through the app, then update the user's role in the database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

### 7. Start the development servers

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## 📁 Project Structure

```
xcraper/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── index.ts          # Database connection
│   │   │   └── schema.ts         # Drizzle schema definitions
│   │   ├── middleware/
│   │   │   └── auth.ts           # Supabase auth middleware
│   │   ├── routes/
│   │   │   ├── auth.ts           # Authentication endpoints
│   │   │   ├── contacts.ts       # Contact management
│   │   │   ├── credits.ts        # Credit system
│   │   │   ├── search.ts         # Search/scraping endpoints
│   │   │   ├── settings.ts       # Settings management
│   │   │   └── users.ts          # User management
│   │   ├── services/
│   │   │   └── apify.ts          # Apify API integration
│   │   ├── scripts/
│   │   │   └── seed-settings.ts  # Default settings seeder
│   │   └── index.ts              # Express app entry point
│   ├── drizzle.config.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/               # shadcn/ui components
│   │   ├── hooks/
│   │   │   ├── useAuth.tsx       # Supabase auth hook
│   │   │   └── use-toast.ts      # Toast notifications
│   │   ├── lib/
│   │   │   ├── api.ts            # API client
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
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── tsconfig.json
├── package.json
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `GET /api/auth/me` - Get current user (requires Bearer token)
- `POST /api/auth/sync` - Sync/create user in database
- `GET /api/auth/verify` - Verify session validity
- `GET /api/auth/admin/users` - Get all users (admin)

### Search & Scraping
- `POST /api/search` - Search Google Maps
- `GET /api/search/:id` - Get search history
- `GET /api/search/history` - Get user's search history

### Contacts
- `GET /api/contacts` - Get user's contacts
- `POST /api/contacts` - Save a contact
- `DELETE /api/contacts/:id` - Delete a contact
- `POST /api/contacts/export` - Export contacts (CSV/JSON)

### Credits
- `GET /api/credits/balance` - Get credit balance
- `GET /api/credits/packages` - Get available packages
- `POST /api/credits/purchase` - Purchase credits
- `GET /api/credits/transactions` - Get transaction history

### Settings (Admin)
- `GET /api/settings/public` - Get public settings (landing page)
- `GET /api/settings/` - Get all settings (admin)
- `PATCH /api/settings/` - Update settings (admin)
- `POST /api/settings/packages` - Create credit package (admin)
- `PATCH /api/settings/packages/:id` - Update package (admin)
- `DELETE /api/settings/packages/:id` - Delete package (admin)

## 💳 Credit System

The platform uses a credit-based billing system:

- **Search Cost**: 1 credit per search
- **Contact Save**: 1 credit per contact saved
- **Example**: Searching for "restaurants in New York" and saving 50 contacts = 51 credits

### Default Credit Packages

| Package | Credits | Price |
|---------|---------|-------|
| Starter | 100 | $9.99 |
| Professional | 500 | $39.99 |
| Business | 1,500 | $99.99 |
| Enterprise | 5,000 | $249.99 |

*Packages can be customized in the admin panel*

## 🔐 Authentication Flow

1. User signs up/logs in via Supabase (email/password or OAuth)
2. Supabase returns a JWT token
3. Frontend sends token to backend in Authorization header
4. Backend verifies token with Supabase
5. User is created/synced in the application database
6. User can now access protected routes

## ⚙️ Admin Panel

Access the admin panel at `/admin/settings` (requires admin role). Configure:

### Branding
- Brand name, tagline, description
- Logo and favicon URLs

### SEO
- Page title and meta description
- Keywords
- Open Graph image
- Twitter handle

### Landing Page Content
- Hero section (title, subtitle, CTA)
- Features section
- Pricing section
- FAQ content
- Testimonials

### Advanced
- Google Analytics ID
- Custom head/body code injection
- Contact information
- Feature flags (registration enabled, free credits on signup)

### Credit Packages
- Create, edit, delete pricing packages
- Set popular/highlighted packages
- Control package ordering

## 🔒 Security Features

- Supabase JWT token authentication
- Password hashing handled by Supabase
- Rate limiting on API endpoints
- CORS protection
- Helmet.js security headers
- Input validation with Zod

## 🚢 Deployment

### Build for Production

```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm run preview  # or serve with nginx/apache
```

### Environment Variables (Production)

Make sure to set these in production:
- `NODE_ENV=production`
- Production `DATABASE_URL`
- Production `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Production `FRONTEND_URL`

### Database Migrations

```bash
cd backend
npm run db:generate  # Generate migration files
npm run db:migrate   # Run migrations
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## ⚠️ Disclaimer

This tool is designed for extracting publicly available business information from Google Maps. Users are responsible for ensuring their use of the tool complies with applicable laws and terms of service. The developers are not responsible for any misuse of this software.

## 📞 Support

For support, email support@xcraper.com or join our Discord channel.

---

Built with ❤️ by the Xcraper Team
