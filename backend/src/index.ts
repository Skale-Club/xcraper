import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import * as dotenv from 'dotenv';
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
import { requestLogger, errorLogger } from './middleware/requestLogger.js';
import { logger, logError } from './utils/logger.js';

dotenv.config();

// Initialize Sentry if DSN is configured
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 0.1, // 10% of transactions
    });
    logger.info('Sentry initialized');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
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
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 1000 : 5000,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
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
app.use('/api/user', gdprRoutes); // GDPR routes (data export, deletion)

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

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
