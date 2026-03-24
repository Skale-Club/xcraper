import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: [
                'favicon.png',
                'apple-touch-icon.png',
                'icon-192.png',
                'icon-512.png',
                'maskable-icon-512.png',
            ],
            manifest: false,
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                navigateFallbackDenylist: [/^\/api\//],
                cleanupOutdatedCaches: true,
                runtimeCaching: [
                    {
                        urlPattern: /^\/api\//,
                        handler: 'NetworkOnly',
                    },
                ],
            },
            devOptions: {
                enabled: false,
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
});
