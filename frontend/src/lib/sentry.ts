import * as Sentry from '@sentry/react';

// Initialize Sentry if DSN is configured
export function initSentry() {
    const dsn = import.meta.env.VITE_SENTRY_DSN;

    if (!dsn) {
        console.log('Sentry DSN not configured, skipping initialization');
        return;
    }

    Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                maskAllText: false,
                blockAllMedia: false,
            }),
        ],

        // Performance Monitoring
        tracesSampleRate: 0.1, // 10% of transactions

        // Session Replay
        replaysSessionSampleRate: 0.1, // 10% of sessions
        replaysOnErrorSampleRate: 1.0, // 100% of errors

        // Filter out sensitive data
        beforeSend(event) {
            // Remove sensitive headers
            if (event.request?.headers) {
                delete event.request.headers['Authorization'];
                delete event.request.headers['Cookie'];
            }
            return event;
        },
    });

    console.log('Sentry initialized');
}

// Helper to capture errors with context
export function captureError(error: Error, context?: Record<string, unknown>) {
    if (context) {
        Sentry.withScope((scope) => {
            Object.entries(context).forEach(([key, value]) => {
                scope.setExtra(key, value);
            });
            Sentry.captureException(error);
        });
    } else {
        Sentry.captureException(error);
    }
}

// Helper to set user context
export function setSentryUser(user: { id: string; email?: string; name?: string } | null) {
    if (user) {
        Sentry.setUser({
            id: user.id,
            email: user.email,
            username: user.name,
        });
    } else {
        Sentry.setUser(null);
    }
}

// Helper to add breadcrumb
export function addBreadcrumb(message: string, category: string, data?: Record<string, unknown>) {
    Sentry.addBreadcrumb({
        message,
        category,
        data,
        level: 'info',
    });
}

export default {
    init: initSentry,
    captureError,
    setUser: setSentryUser,
    addBreadcrumb,
};
