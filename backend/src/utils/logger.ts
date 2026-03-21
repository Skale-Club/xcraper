import * as winston from 'winston';
import * as path from 'path';

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
    winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
        }
        return msg;
    })
);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Define transports
const transports: winston.transport[] = [
    // Console transport (always enabled)
    new winston.transports.Console({
        format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
    }),

    // File transport for all logs
    new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        format: logFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 30,
        level: 'info'
    }),

    // File transport for errors only
    new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        format: logFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 10,
        level: 'error'
    })
];

// Create the logger instance
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    format: logFormat,
    defaultMeta: {
        service: 'xcraper-api',
        environment: process.env.NODE_ENV || 'development'
    },
    transports,
    exitOnError: false
});

// Helper functions for common log patterns
export const logInfo = (message: string, meta?: Record<string, unknown>) => {
    logger.info(message, meta);
};

export const logWarn = (message: string, meta?: Record<string, unknown>) => {
    logger.warn(message, meta);
};

export const logError = (message: string, error?: Error | unknown, meta?: Record<string, unknown>) => {
    const errorMeta = error instanceof Error
        ? { errorMessage: error.message, stack: error.stack, ...meta }
        : { error, ...meta };
    logger.error(message, errorMeta);
};

export const logDebug = (message: string, meta?: Record<string, unknown>) => {
    logger.debug(message, meta);
};

// Request logger helper
export const logRequest = (req: {
    method: string;
    url: string;
    ip?: string;
    user?: { id: string };
    headers?: Record<string, string>;
}, statusCode: number, duration: number) => {
    const logData = {
        method: req.method,
        url: req.url,
        statusCode,
        duration: `${duration}ms`,
        userId: req.user?.id,
        ip: req.ip
    };

    if (statusCode >= 400) {
        logWarn(`HTTP ${req.method} ${req.url} - ${statusCode}`, logData);
    } else {
        logInfo(`HTTP ${req.method} ${req.url} - ${statusCode}`, logData);
    }
};

// Business event loggers
export const logSearchEvent = (event: string, data: {
    userId: string;
    searchId?: string;
    query?: string;
    location?: string;
    resultsCount?: number;
    creditsUsed?: number;
    duration?: number;
    error?: string;
}) => {
    logger.info(`search_${event}`, {
        ...data,
        category: 'search'
    });
};

export const logCreditEvent = (event: string, data: {
    userId: string;
    amount: number;
    type: string;
    balance?: number;
    description?: string;
    relatedId?: string;
}) => {
    logger.info(`credit_${event}`, {
        ...data,
        category: 'credits'
    });
};

export const logAuthEvent = (event: string, data: {
    userId?: string;
    email?: string;
    ip?: string;
    success: boolean;
    reason?: string;
}) => {
    const level = data.success ? 'info' : 'warn';
    logger.log(level, `auth_${event}`, {
        ...data,
        category: 'auth'
    });
};

export const logBillingEvent = (event: string, data: {
    userId: string;
    amount?: number;
    currency?: string;
    stripePaymentId?: string;
    success: boolean;
    error?: string;
}) => {
    const level = data.success ? 'info' : 'error';
    logger.log(level, `billing_${event}`, {
        ...data,
        category: 'billing'
    });
};

export default logger;
