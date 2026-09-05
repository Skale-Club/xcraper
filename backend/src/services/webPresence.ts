export type WebPresenceType =
    | 'owned_website'
    | 'booking_platform'
    | 'social_profile'
    | 'directory_listing'
    | 'link_hub'
    | 'none';

export interface WebPresenceClassification {
    type: WebPresenceType;
    sourceUrl: string | null;
    platform: string | null;
    ownedWebsiteUrl: string | null;
    ownedDomain: string | null;
    bookingPlatform: string | null;
    bookingUrl: string | null;
}

type HostPlatform = { domains: string[]; name: string };

const BOOKING_PLATFORMS: HostPlatform[] = [
    { domains: ['booksy.com'], name: 'Booksy' },
    { domains: ['thecut.co'], name: 'TheCut' },
    { domains: ['getsquire.com'], name: 'Squire' },
    { domains: ['glossgenius.com'], name: 'GlossGenius' },
    { domains: ['vagaro.com'], name: 'Vagaro' },
    { domains: ['fresha.com'], name: 'Fresha' },
    { domains: ['styleseat.com'], name: 'StyleSeat' },
    { domains: ['schedulicity.com'], name: 'Schedulicity' },
    { domains: ['setmore.com'], name: 'Setmore' },
    { domains: ['acuityscheduling.com'], name: 'Acuity Scheduling' },
    { domains: ['mindbodyonline.com', 'mindbody.io'], name: 'Mindbody' },
    { domains: ['simplybook.me'], name: 'SimplyBook.me' },
    { domains: ['appointy.com'], name: 'Appointy' },
    { domains: ['mytime.com'], name: 'MyTime' },
    { domains: ['phorest.com'], name: 'Phorest' },
    { domains: ['joinblvd.com', 'boulevard.io'], name: 'Boulevard' },
    { domains: ['meevo.com'], name: 'Meevo' },
    { domains: ['zenoti.com'], name: 'Zenoti' },
    { domains: ['salonized.com'], name: 'Salonized' },
    { domains: ['gettimely.com'], name: 'Timely' },
    { domains: ['square.site', 'squareup.com'], name: 'Square Appointments' },
    { domains: ['calendly.com'], name: 'Calendly' },
    { domains: ['cal.com'], name: 'Cal.com' },
    { domains: ['resy.com'], name: 'Resy' },
    { domains: ['opentable.com'], name: 'OpenTable' },
];

const SOCIAL_PLATFORMS: HostPlatform[] = [
    { domains: ['facebook.com', 'fb.com'], name: 'Facebook' },
    { domains: ['instagram.com'], name: 'Instagram' },
    { domains: ['tiktok.com'], name: 'TikTok' },
    { domains: ['x.com', 'twitter.com'], name: 'X' },
    { domains: ['linkedin.com'], name: 'LinkedIn' },
    { domains: ['youtube.com', 'youtu.be'], name: 'YouTube' },
];

const DIRECTORY_PLATFORMS: HostPlatform[] = [
    { domains: ['google.com', 'goo.gl'], name: 'Google Maps' },
    { domains: ['yelp.com'], name: 'Yelp' },
    { domains: ['mapquest.com'], name: 'MapQuest' },
    { domains: ['yellowpages.com'], name: 'Yellow Pages' },
    { domains: ['chamberofcommerce.com'], name: 'Chamber of Commerce' },
    { domains: ['worldorgs.com'], name: 'WorldOrgs' },
    { domains: ['mapstuk.top'], name: 'Maps directory' },
    { domains: ['u77a.top'], name: 'Business directory' },
];

const LINK_HUBS: HostPlatform[] = [
    { domains: ['linktr.ee'], name: 'Linktree' },
    { domains: ['beacons.ai'], name: 'Beacons' },
    { domains: ['dot.cards'], name: 'Dot Cards' },
    { domains: ['bio.site'], name: 'Bio Sites' },
];

function parseUrl(raw: string | null | undefined): { url: string; host: string } | null {
    const value = raw?.trim();
    if (!value) return null;
    try {
        let url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        if (!['http:', 'https:'].includes(url.protocol)) return null;
        const host = url.hostname.toLowerCase().replace(/^www\./, '');
        const redirectTarget =
            ((host === 'google.com' || host.endsWith('.google.com')) && url.pathname === '/url'
                ? url.searchParams.get('q') || url.searchParams.get('url')
                : null) ||
            ((host === 'facebook.com' || host.endsWith('.facebook.com')) && url.pathname.endsWith('/l.php')
                ? url.searchParams.get('u')
                : null);
        if (redirectTarget) {
            const unwrapped = new URL(redirectTarget);
            if (['http:', 'https:'].includes(unwrapped.protocol)) url = unwrapped;
        }
        return {
            url: url.href,
            host: url.hostname.toLowerCase().replace(/^www\./, ''),
        };
    } catch {
        return null;
    }
}

function findPlatform(host: string, catalog: HostPlatform[]): HostPlatform | null {
    return catalog.find(({ domains }) => domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) ?? null;
}

/**
 * Classify the primary URL Google exposes for a business. A social profile is
 * used only when Google did not return any website-like URL, preserving a
 * useful web-presence signal without pretending the business owns a domain.
 */
export function classifyWebPresence(
    website?: string | null,
    socialProfiles: Array<string | null | undefined> = [],
): WebPresenceClassification {
    const parsed = parseUrl(website) ?? socialProfiles.map(parseUrl).find((value) => value !== null) ?? null;
    if (!parsed) {
        return {
            type: 'none',
            sourceUrl: null,
            platform: null,
            ownedWebsiteUrl: null,
            ownedDomain: null,
            bookingPlatform: null,
            bookingUrl: null,
        };
    }

    const booking = findPlatform(parsed.host, BOOKING_PLATFORMS);
    if (booking) {
        return {
            type: 'booking_platform',
            sourceUrl: parsed.url,
            platform: booking.name,
            ownedWebsiteUrl: null,
            ownedDomain: null,
            bookingPlatform: booking.name,
            bookingUrl: parsed.url,
        };
    }

    const social = findPlatform(parsed.host, SOCIAL_PLATFORMS);
    if (social) {
        return {
            type: 'social_profile',
            sourceUrl: parsed.url,
            platform: social.name,
            ownedWebsiteUrl: null,
            ownedDomain: null,
            bookingPlatform: null,
            bookingUrl: null,
        };
    }

    const directory = findPlatform(parsed.host, DIRECTORY_PLATFORMS);
    if (directory) {
        return {
            type: 'directory_listing',
            sourceUrl: parsed.url,
            platform: directory.name,
            ownedWebsiteUrl: null,
            ownedDomain: null,
            bookingPlatform: null,
            bookingUrl: null,
        };
    }

    const linkHub = findPlatform(parsed.host, LINK_HUBS);
    if (linkHub) {
        return {
            type: 'link_hub',
            sourceUrl: parsed.url,
            platform: linkHub.name,
            ownedWebsiteUrl: null,
            ownedDomain: null,
            bookingPlatform: null,
            bookingUrl: null,
        };
    }

    return {
        type: 'owned_website',
        sourceUrl: parsed.url,
        platform: null,
        ownedWebsiteUrl: parsed.url,
        ownedDomain: parsed.host,
        bookingPlatform: null,
        bookingUrl: null,
    };
}
