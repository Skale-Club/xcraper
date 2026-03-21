import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logRequest, logError, logInfo } from '../utils/logger.js';

// Extend Request type to include id
declare global {
    namespace Express {
        interface Request {
            id: string;
            startTime?: number;
        }
    }
}

/**
 * Request Logger Middleware
 * Adds a unique request ID and logs request details
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    // Generate unique request ID
    req.id = uuidv4();
    req.startTime = Date.now();

    // Add request ID to response headers for tracing
    res.setHeader('X-Request-Id', req.id);

    // Log request start
    logInfo(`Request started: ${req.method} ${req.url}`, {
        requestId: req.id,
        method: req.method,
        url: req.url,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        ip: req.ip,
        userAgent: req.get('user-agent')
    });

    // Log response on finish
    res.on('finish', () => {
        const duration = Date.now() - (req.startTime || 0);
        logRequest({
            method: req.method,
            url: req.url,
            ip: req.ip,
            user: req.user
        }, res.statusCode, duration);
    });

    // Log errors
    res.on('error', (error) => {
        const duration = Date.now() - (req.startTime || 0);
        logError(`Request error: ${req.method} ${req.url}`, error, {
            requestId: req.id,
            duration
        });
    });

    next();
};

/**
 * Error Logger Middleware
 * Catches and logs unhandled errors
 */
export const errorLogger = (err: Error, req: Request, res: Response, next: NextFunction) => {
    const duration = Date.now() - (req.startTime || 0);

    logError(`Unhandled error: ${err.message}`, err, {
        requestId: req.id,
        method: req.method,
        url: req.url,
        body: req.body,
        query: req.query,
        params: req.params,
        userId: req.user?.id,
        duration
    });

    next(err);
};

export default requestLogger;
