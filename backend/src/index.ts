import * as dotenv from 'dotenv';

dotenv.config();

import { createApp } from './app.js';
import { getPort, isServerless } from './config/runtime.js';

const app = createApp();
const PORT = getPort();

// Two hosting modes share this file:
//  - Vercel: api/index.ts imports createApp() directly and Vercel invokes the
//    exported handler per request; nothing may call app.listen().
//  - Everything else (local dev, the Docker image, any VPS): a long-running
//    process that listens on PORT and shuts down cleanly on SIGTERM so
//    `docker stop` / a Coolify redeploy lets in-flight requests finish.
if (!isServerless()) {
    const server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    const shutdown = (signal: string) => {
        console.log(`${signal} received, closing HTTP server`);
        server.close(() => process.exit(0));
        // SSE streams keep connections open; don't wait for them forever.
        setTimeout(() => process.exit(0), 10_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

// Export the Express app for Vercel serverless functions
export default app;
