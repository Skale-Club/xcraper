import type { VercelRequest, VercelResponse } from '@vercel/node';

// Force Vercel NFT to include proxy-agent and its dependency tree
import 'proxy-agent';

// Dynamic import of Express app
let app: any;

async function getApp() {
    if (!app) {
        // Import Express app
        const express = await import('express');
        const cors = (await import('cors')).default;
        const helmet = (await import('helmet')).default;
        const rateLimit = (await import('express-rate-limit')).default;

        // Import routes
        const authRoutes = (await import('../backend/dist/routes/auth.js')).default;
        const userRoutes = (await import('../backend/dist/routes/users.js')).default;
        const searchRoutes = (await import('../backend/dist/routes/search.js')).default;
        const contactRoutes = (await import('../backend/dist/routes/contacts.js')).default;
        const creditRoutes = (await import('../backend/dist/routes/credits.js')).default;
        const settingsRoutes = (await import('../backend/dist/routes/settings.js')).default;
        const paymentRoutes = (await import('../backend/dist/routes/payments.js')).default;
        const onboardingRoutes = (await import('../backend/dist/routes/onboarding.js')).default;
        const adminRoutes = (await import('../backend/dist/routes/admin.js')).default;
        const subscriptionRoutes = (await import('../backend/dist/routes/subscriptions.js')).default;
        const placesRoutes = (await import('../backend/dist/routes/places.js')).default;
        const uploadRoutes = (await import('../backend/dist/routes/upload.js')).default;
        const sseRoutes = (await import('../backend/dist/routes/sse.js')).default;
        const pnlRoutes = (await import('../backend/dist/routes/pnl.js')).default;
        const gdprRoutes = (await import('../backend/dist/routes/gdpr.js')).default;
        const webhookRoutes = (await import('../backend/dist/routes/webhooks.js')).default;
        const adminBillingRoutes = (await import('../backend/dist/routes/adminBilling.js')).default;
        const keepaliveRoutes = (await import('../backend/dist/routes/keepalive.js')).default;

        // Create Express app
        app = express.default();

        // Security middleware
        app.use(helmet({ contentSecurityPolicy: false }));

        // CORS configuration
        app.use(cors({
            origin: process.env.NODE_ENV === 'production'
                ? process.env.FRONTEND_URL
                : 'http://localhost:5173',
            credentials: true,
        }));

        // Body parsing
        app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
        app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));
        app.use(express.json({ limit: '10mb' }));
        app.use(express.urlencoded({ extended: true }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: process.env.NODE_ENV === 'production' ? 1000 : 5000,
            message: { error: 'Too many requests, please try again later.' },
        });
        app.use('/api/', limiter);

        // API Routes
        app.use('/api/auth', authRoutes);
        app.use('/api/users', userRoutes);
        app.use('/api/search', searchRoutes);
        app.use('/api/contacts', contactRoutes);
        app.use('/api/credits', creditRoutes);
        app.use('/api/settings', settingsRoutes);
        app.use('/api/payments', paymentRoutes);
        app.use('/api/onboarding', onboardingRoutes);
        app.use('/api/admin', adminRoutes);
        app.use('/api/admin/billing', adminBillingRoutes);
        app.use('/api/subscriptions', subscriptionRoutes);
        app.use('/api/places', placesRoutes);
        app.use('/api/webhooks', webhookRoutes);
        app.use('/api/upload', uploadRoutes);
        app.use('/api/sse', sseRoutes);
        app.use('/api/pnl', pnlRoutes);
        app.use('/api/user', gdprRoutes);
        app.use('/api/keepalive', keepaliveRoutes);

        // Health check
        app.get('/api/health', (req: any, res: any) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // Error handling
        app.use((err: any, req: any, res: any, next: any) => {
            console.error('Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });

        // 404 handler
        app.use((req: any, res: any) => {
            res.status(404).json({ error: 'Not found' });
        });
    }
    return app;
}

// Vercel serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const expressApp = await getApp();
        return expressApp(req, res);
    } catch (error) {
        console.error('Handler error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
