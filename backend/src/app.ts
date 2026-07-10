import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import searchRoutes from './routes/search.js';
import contactRoutes from './routes/contacts.js';
import creditRoutes from './routes/credits.js';
import settingsRoutes from './routes/settings.js';
import paymentRoutes from './routes/payments.js';
import onboardingRoutes from './routes/onboarding.js';
import adminRoutes from './routes/admin.js';
import subscriptionRoutes from './routes/subscriptions.js';
import adminBillingRoutes from './routes/adminBilling.js';
import placesRoutes from './routes/places.js';
import webhookRoutes from './routes/webhooks.js';
import uploadRoutes from './routes/upload.js';
import sseRoutes from './routes/sse.js';
import pnlRoutes from './routes/pnl.js';
import gdprRoutes from './routes/gdpr.js';
import keepaliveRoutes from './routes/keepalive.js';
import integrationsRoutes from './routes/integrations.js';
import serviceRoutes from './routes/service.js';
import { requestLogger } from './middleware/requestLogger.js';
import { logger, logError } from './utils/logger.js';

let sentryInitialized = false;

// Stripe/Apify retry bursts come from shared egress IPs; the general IP-keyed
// limiter must not throttle them — each webhook verifies its own secret.
const WEBHOOK_PATHS = new Set([
    '/api/payments/webhook',
    '/api/subscriptions/webhook',
    '/api/webhooks/apify',
]);

/**
 * Build the fully-configured Express app. Single source of truth for both the
 * traditional server (src/index.ts) and the Vercel serverless entry
 * (api/index.ts) — middleware added here applies to production automatically.
 */
export function createApp(): express.Express {
    if (process.env.SENTRY_DSN && !sentryInitialized) {
        Sentry.init({
            dsn: process.env.SENTRY_DSN,
            environment: process.env.NODE_ENV || 'development',
            tracesSampleRate: 0.1, // 10% of transactions
        });
        sentryInitialized = true;
        logger.info('Sentry initialized');
    }

    const app = express();

    // Trust proxy for rate limiting behind reverse proxy (Vercel/local proxies)
    app.set('trust proxy', 1);

    // Security middleware
    app.use(helmet({
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'", 'https:'],
                frameAncestors: ["'none'"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: [],
            },
        },
        crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    app.use(cors({
        origin: process.env.NODE_ENV === 'production'
            ? process.env.FRONTEND_URL
            : 'http://localhost:5173',
        credentials: true,
    }));

    // Body parsing (except for webhook routes which needs raw body for Stripe)
    app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
    app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));
    // Apify webhooks use JSON body (not raw)

    // Regular JSON parsing for other routes
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Request logging middleware
    app.use(requestLogger);

    // HTTP logging (morgan for additional HTTP logging)
    app.use(morgan('combined', {
        stream: {
            write: (message) => logger.http(message.trim())
        }
    }));

    // Rate limiting
    const isProd = process.env.NODE_ENV === 'production';
    const defaultRateLimitOpts = {
        standardHeaders: true,
        legacyHeaders: false,
    } as const;

    // Strict limiter for auth endpoints (login/register/password reset) — prevents brute force
    const authLimiter = rateLimit({
        ...defaultRateLimitOpts,
        windowMs: 15 * 60 * 1000,
        max: isProd ? 20 : 200,
        message: { error: 'Too many authentication attempts, please try again later.' },
    });

    // Tight limiter for search (Apify quota / cost protection)
    const searchLimiter = rateLimit({
        ...defaultRateLimitOpts,
        windowMs: 60 * 1000,
        max: isProd ? 30 : 300,
        message: { error: 'Too many search requests, please slow down.' },
    });

    // Admin and billing endpoints — lower threshold than default
    const adminLimiter = rateLimit({
        ...defaultRateLimitOpts,
        windowMs: 15 * 60 * 1000,
        max: isProd ? 200 : 2000,
        message: { error: 'Too many admin requests, please try again later.' },
    });

    // General API limiter — catch-all
    const generalLimiter = rateLimit({
        ...defaultRateLimitOpts,
        windowMs: 15 * 60 * 1000,
        max: isProd ? 1000 : 5000,
        message: { error: 'Too many requests, please try again later.' },
        skip: (req) => WEBHOOK_PATHS.has(req.originalUrl.split('?')[0]),
    });
    app.use('/api/', generalLimiter);

    // API Routes (specific limiters mounted before route handlers)
    app.use('/api/auth', authLimiter, authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/search', searchLimiter, searchRoutes);
    app.use('/api/contacts', contactRoutes);
    app.use('/api/credits', creditRoutes);
    app.use('/api/settings', settingsRoutes);
    app.use('/api/payments', paymentRoutes);
    app.use('/api/onboarding', onboardingRoutes);
    app.use('/api/admin', adminLimiter, adminRoutes);
    app.use('/api/admin/billing', adminLimiter, adminBillingRoutes);
    app.use('/api/subscriptions', subscriptionRoutes);
    app.use('/api/places', placesRoutes);
    app.use('/api/webhooks', webhookRoutes);
    app.use('/api/upload', uploadRoutes);
    app.use('/api/sse', sseRoutes);
    app.use('/api/pnl', pnlRoutes);
    app.use('/api/user', gdprRoutes); // GDPR routes (data export, deletion)
    app.use('/api/keepalive', keepaliveRoutes);
    app.use('/api/integrations', integrationsRoutes);
    app.use('/api/service', serviceRoutes); // machine-to-machine (Hermes): scrape + auto-push to Xphere, no login

    // Health check endpoint
    app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Sentry error handler (must be before other error handlers)
    if (process.env.SENTRY_DSN) {
        app.use(Sentry.expressErrorHandler());
    }

    // Error handling middleware
    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        logError('Unhandled error', err, {
            method: req.method,
            url: req.url,
            userId: req.user?.id,
            body: req.body
        });

        res.status(500).json({
            error: process.env.NODE_ENV === 'production'
                ? 'Internal server error'
                : err.message
        });
    });

    // 404 handler
    app.use((req, res) => {
        res.status(404).json({ error: 'Not found' });
    });

    return app;
}
