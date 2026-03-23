import { getApiUrl } from './api';

type PublicRuntimeConfigResponse = {
    settings: {
        brandName: string;
        brandDescription: string;
        faviconUrl?: string | null;
    };
    runtime: {
        googleMapsApiKey?: string | null;
        sentryDsn?: string | null;
        pwaName: string;
        pwaShortName: string;
        pwaDescription: string;
        pwaThemeColor: string;
        pwaBackgroundColor: string;
        pwaIcon192Url?: string | null;
        pwaIcon512Url?: string | null;
        pwaMaskableIcon512Url?: string | null;
        pwaAppleTouchIconUrl?: string | null;
    };
};

let runtimeConfigPromise: Promise<PublicRuntimeConfigResponse | null> | null = null;
let manifestObjectUrl: string | null = null;

const fallbackRuntimeConfig: PublicRuntimeConfigResponse = {
    settings: {
        brandName: 'Xcraper',
        brandDescription: 'Google Maps lead generation and contact scraping platform.',
        faviconUrl: null,
    },
    runtime: {
        googleMapsApiKey: null,
        sentryDsn: null,
        pwaName: 'Xcraper',
        pwaShortName: 'Xcraper',
        pwaDescription: 'Google Maps lead generation and contact scraping platform.',
        pwaThemeColor: '#0f172a',
        pwaBackgroundColor: '#0f172a',
        pwaIcon192Url: null,
        pwaIcon512Url: null,
        pwaMaskableIcon512Url: null,
        pwaAppleTouchIconUrl: null,
    },
};

function upsertLink(id: string, rel: string, href: string) {
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
        link = document.createElement('link');
        link.id = id;
        link.rel = rel;
        document.head.appendChild(link);
    }

    link.href = href;
}

function upsertMeta(name: string, content: string) {
    let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', name);
        document.head.appendChild(meta);
    }

    meta.setAttribute('content', content);
}

function resolveAppAsset(url: string | null | undefined, fallbackPath: string) {
    return url || new URL(fallbackPath, window.location.origin).toString();
}

function applyManifest(config: PublicRuntimeConfigResponse) {
    const manifest = {
        id: '/',
        name: config.runtime.pwaName || config.settings.brandName,
        short_name: config.runtime.pwaShortName || config.settings.brandName,
        description: config.runtime.pwaDescription || config.settings.brandDescription,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: config.runtime.pwaBackgroundColor,
        theme_color: config.runtime.pwaThemeColor,
        icons: [
            {
                src: resolveAppAsset(config.runtime.pwaIcon192Url || config.settings.faviconUrl, '/icon-192.png'),
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: resolveAppAsset(config.runtime.pwaIcon512Url || config.settings.faviconUrl, '/icon-512.png'),
                sizes: '512x512',
                type: 'image/png',
            },
            {
                src: resolveAppAsset(config.runtime.pwaMaskableIcon512Url || config.settings.faviconUrl, '/maskable-icon-512.png'),
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
    };

    if (manifestObjectUrl) {
        URL.revokeObjectURL(manifestObjectUrl);
    }

    manifestObjectUrl = URL.createObjectURL(
        new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }),
    );

    upsertLink('app-manifest', 'manifest', manifestObjectUrl);
}

function applyHeadConfig(config: PublicRuntimeConfigResponse) {
    upsertMeta('theme-color', config.runtime.pwaThemeColor);
    upsertLink('app-favicon', 'icon', config.settings.faviconUrl || '/favicon.png');
    upsertLink(
        'app-apple-touch-icon',
        'apple-touch-icon',
        resolveAppAsset(config.runtime.pwaAppleTouchIconUrl || config.settings.faviconUrl, '/apple-touch-icon.png'),
    );
    applyManifest(config);
}

export async function loadPublicRuntimeConfig(): Promise<PublicRuntimeConfigResponse | null> {
    if (!runtimeConfigPromise) {
        runtimeConfigPromise = fetch(getApiUrl('/settings/public'))
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Runtime config request failed: ${response.status}`);
                }

                return response.json() as Promise<PublicRuntimeConfigResponse>;
            })
            .then((config) => {
                applyHeadConfig(config);
                return config;
            })
            .catch((error) => {
                console.warn('Failed to load public runtime config:', error);
                applyHeadConfig(fallbackRuntimeConfig);
                return null;
            });
    }

    return runtimeConfigPromise;
}

export async function getGoogleMapsBrowserApiKey(): Promise<string | null> {
    const config = await loadPublicRuntimeConfig();
    return config?.runtime.googleMapsApiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || null;
}

export async function getPublicSentryDsn(): Promise<string | null> {
    const config = await loadPublicRuntimeConfig();
    return config?.runtime.sentryDsn || import.meta.env.VITE_SENTRY_DSN || null;
}
