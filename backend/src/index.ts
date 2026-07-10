import * as dotenv from 'dotenv';

dotenv.config();

import { createApp } from './app.js';

const app = createApp();
const PORT = process.env.PORT || 3001;

// Start server only in non-serverless environments (local development, traditional hosting)
// Vercel serverless functions don't use app.listen()
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}

// Export the Express app for Vercel serverless functions
export default app;
