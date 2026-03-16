/**
 * Extract social media URLs from Apify rawData
 * Returns the first URL for each platform (if available)
 */
export function extractSocialMediaFromRawData(rawData: any): {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
    pinterest?: string;
} {
    if (!rawData) {
        return {};
    }

    const result: Record<string, string> = {};

    // Extract Facebook
    if (Array.isArray(rawData.facebooks) && rawData.facebooks.length > 0) {
        result.facebook = rawData.facebooks[0];
    }

    // Extract Instagram
    if (Array.isArray(rawData.instagrams) && rawData.instagrams.length > 0) {
        result.instagram = rawData.instagrams[0];
    }

    // Extract Twitter
    if (Array.isArray(rawData.twitters) && rawData.twitters.length > 0) {
        result.twitter = rawData.twitters[0];
    }

    // Extract LinkedIn
    if (Array.isArray(rawData.linkedIns) && rawData.linkedIns.length > 0) {
        result.linkedin = rawData.linkedIns[0];
    }

    // Extract YouTube
    if (Array.isArray(rawData.youtubes) && rawData.youtubes.length > 0) {
        // Filter out embed URLs, prefer channel URLs
        const channelUrl = rawData.youtubes.find((url: string) =>
            url.includes('/channel/') || url.includes('/@')
        );
        result.youtube = channelUrl || rawData.youtubes[0];
    }

    // Extract TikTok
    if (Array.isArray(rawData.tiktoks) && rawData.tiktoks.length > 0) {
        result.tiktok = rawData.tiktoks[0];
    }

    // Extract Pinterest
    if (Array.isArray(rawData.pinterests) && rawData.pinterests.length > 0) {
        result.pinterest = rawData.pinterests[0];
    }

    return result;
}
