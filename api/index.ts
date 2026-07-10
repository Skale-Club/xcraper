import type { VercelRequest, VercelResponse } from '@vercel/node';

// Force Vercel NFT to include proxy-agent and its dependency tree
import 'proxy-agent';

// The app factory lives in the backend workspace so the serverless entry and
// the traditional server (backend/src/index.ts) share one configuration —
// helmet CSP, Sentry, trust proxy, logging, rate limits, and every route.
let app: any;

async function getApp() {
    if (!app) {
        const { createApp } = await import('../backend/dist/app.js');
        app = createApp();
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
