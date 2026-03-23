import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { settings, creditPackages } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { systemSettingsService } from '../services/systemSettings.js';

const router = Router();
const DEFAULT_ID = 'default';

async function ensureSettingsRecord() {
    let [settingsRecord] = await db
        .select()
        .from(settings)
        .where(eq(settings.id, DEFAULT_ID))
        .limit(1);

    if (!settingsRecord) {
        [settingsRecord] = await db.insert(settings).values({ id: DEFAULT_ID }).returning();
    }

    return settingsRecord;
}

function buildPublicSettingsPayload(settingsRecord: typeof settings.$inferSelect) {
    return {
        brandName: settingsRecord.brandName,
        brandTagline: settingsRecord.brandTagline,
        brandDescription: settingsRecord.brandDescription,
        logoUrl: settingsRecord.logoUrl,
        faviconUrl: settingsRecord.faviconUrl,
        seoTitle: settingsRecord.seoTitle,
        seoDescription: settingsRecord.seoDescription,
        seoKeywords: settingsRecord.seoKeywords,
        ogImageUrl: settingsRecord.ogImageUrl,
        twitterHandle: settingsRecord.twitterHandle,
        heroTitle: settingsRecord.heroTitle,
        heroSubtitle: settingsRecord.heroSubtitle,
        heroCtaText: settingsRecord.heroCtaText,
        featuresTitle: settingsRecord.featuresTitle,
        featuresSubtitle: settingsRecord.featuresSubtitle,
        pricingTitle: settingsRecord.pricingTitle,
        pricingSubtitle: settingsRecord.pricingSubtitle,
        faqTitle: settingsRecord.faqTitle,
        faqContent: settingsRecord.faqContent,
        testimonialsEnabled: settingsRecord.testimonialsEnabled,
        testimonialsContent: settingsRecord.testimonialsContent,
        footerText: settingsRecord.footerText,
        footerLinks: settingsRecord.footerLinks,
        socialLinks: settingsRecord.socialLinks,
        registrationEnabled: settingsRecord.registrationEnabled,
        freeCreditsOnSignup: settingsRecord.freeCreditsOnSignup,
        creditsPerStandardResult: settingsRecord.creditsPerStandardResult,
        creditsPerEnrichedResult: settingsRecord.creditsPerEnrichedResult,
        enrichmentPricingMode: settingsRecord.enrichmentPricingMode,
        chargeForDuplicates: settingsRecord.chargeForDuplicates,
        duplicateWindowDays: settingsRecord.duplicateWindowDays,
        contactEmail: settingsRecord.contactEmail,
        contactPhone: settingsRecord.contactPhone,
        contactAddress: settingsRecord.contactAddress,
        gtmContainerId: settingsRecord.gtmContainerId,
    };
}

const updateSettingsSchema = z.object({
    brandName: z.string().min(1).optional(),
    brandTagline: z.string().min(1).optional(),
    brandDescription: z.string().min(1).optional(),
    logoUrl: z.string().url().nullable().optional(),
    faviconUrl: z.string().url().nullable().optional(),
    seoTitle: z.string().min(1).optional(),
    seoDescription: z.string().min(1).optional(),
    seoKeywords: z.string().min(1).optional(),
    ogImageUrl: z.string().url().nullable().optional(),
    twitterHandle: z.string().nullable().optional(),
    heroTitle: z.string().min(1).optional(),
    heroSubtitle: z.string().min(1).optional(),
    heroCtaText: z.string().min(1).optional(),
    featuresTitle: z.string().min(1).optional(),
    featuresSubtitle: z.string().min(1).optional(),
    pricingTitle: z.string().min(1).optional(),
    pricingSubtitle: z.string().min(1).optional(),
    faqTitle: z.string().min(1).optional(),
    faqContent: z.array(z.object({
        question: z.string(),
        answer: z.string(),
    })).optional(),
    testimonialsEnabled: z.boolean().optional(),
    testimonialsContent: z.array(z.object({
        name: z.string(),
        role: z.string(),
        company: z.string(),
        content: z.string(),
        avatar: z.string().optional(),
    })).optional(),
    footerText: z.string().min(1).optional(),
    footerLinks: z.array(z.object({
        label: z.string(),
        url: z.string(),
    })).optional(),
    socialLinks: z.array(z.object({
        platform: z.string(),
        url: z.string(),
    })).optional(),
    contactEmail: z.string().email().nullable().optional(),
    contactPhone: z.string().nullable().optional(),
    contactAddress: z.string().nullable().optional(),
    gtmContainerId: z.string().nullable().optional(),
    registrationEnabled: z.boolean().optional(),
    freeCreditsOnSignup: z.number().int().min(0).optional(),
    creditsPerStandardResult: z.number().int().min(1).optional(),
    creditsPerEnrichedResult: z.number().int().min(1).optional(),
    enrichmentPricingMode: z.enum(['fixed', 'base_plus_enrichment']).optional(),
    chargeForDuplicates: z.boolean().optional(),
    duplicateWindowDays: z.number().int().min(0).optional(),
});

const updateSystemSettingsSchema = z.object({
    apifyBaseRunCostUsd: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
    apifyMinRunChargeUsd: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
    apifyStandardActorId: z.string().min(1).optional(),
    apifyStandardActorName: z.string().min(1).optional(),
    apifyStandardCostPerResultUsd: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
    apifyStandardFixedStartCostUsd: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
    apifyStandardMemoryMb: z.number().int().min(128).optional(),
    apifyEnrichedActorId: z.string().min(1).optional(),
    apifyEnrichedActorName: z.string().min(1).optional(),
    apifyEnrichedCostPerResultUsd: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
    apifyEnrichedFixedStartCostUsd: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
    apifyEnrichedMemoryMb: z.number().int().min(128).optional(),
    defaultSearchLanguage: z.string().min(2).max(8).optional(),
    defaultSearchCountryCode: z.string().min(2).max(2).optional(),
    publicGoogleMapsApiKey: z.string().nullable().optional(),
    publicSentryDsn: z.string().nullable().optional(),
    pwaName: z.string().min(1).optional(),
    pwaShortName: z.string().min(1).max(30).optional(),
    pwaDescription: z.string().min(1).optional(),
    pwaThemeColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
    pwaBackgroundColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
    pwaIcon192Url: z.string().url().nullable().optional(),
    pwaIcon512Url: z.string().url().nullable().optional(),
    pwaMaskableIcon512Url: z.string().url().nullable().optional(),
    pwaAppleTouchIconUrl: z.string().url().nullable().optional(),
});

router.get('/public', async (_req, res: Response): Promise<void> => {
    try {
        const settingsRecord = await ensureSettingsRecord();
        const runtime = await systemSettingsService.getPublicRuntimeSettings();
        const packages = await db.select()
            .from(creditPackages)
            .where(eq(creditPackages.isActive, true))
            .orderBy(creditPackages.sortOrder);

        res.json({
            settings: buildPublicSettingsPayload(settingsRecord),
            runtime,
            packages: packages.map((pkg) => ({
                id: pkg.id,
                name: pkg.name,
                credits: pkg.credits,
                price: pkg.price,
                description: pkg.description,
                isPopular: pkg.isPopular,
            })),
        });
    } catch (error) {
        console.error('Get public settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/manifest.webmanifest', async (_req, res: Response): Promise<void> => {
    try {
        const settingsRecord = await ensureSettingsRecord();
        const runtime = await systemSettingsService.getPublicRuntimeSettings();
        const icons = [
            runtime.pwaIcon192Url ? {
                src: runtime.pwaIcon192Url,
                sizes: '192x192',
                type: 'image/png',
            } : null,
            runtime.pwaIcon512Url ? {
                src: runtime.pwaIcon512Url,
                sizes: '512x512',
                type: 'image/png',
            } : null,
            runtime.pwaMaskableIcon512Url ? {
                src: runtime.pwaMaskableIcon512Url,
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            } : null,
        ].filter(Boolean);

        res.setHeader('Content-Type', 'application/manifest+json');
        res.json({
            id: '/',
            name: runtime.pwaName || settingsRecord.brandName,
            short_name: runtime.pwaShortName || settingsRecord.brandName,
            description: runtime.pwaDescription || settingsRecord.brandDescription,
            start_url: '/',
            scope: '/',
            display: 'standalone',
            orientation: 'portrait',
            background_color: runtime.pwaBackgroundColor,
            theme_color: runtime.pwaThemeColor,
            icons,
        });
    } catch (error) {
        console.error('Get manifest error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/', requireAuth, requireAdmin, async (_req, res: Response): Promise<void> => {
    try {
        const settingsRecord = await ensureSettingsRecord();
        const systemSettingsRecord = await systemSettingsService.getSettings();
        const packages = await db.select()
            .from(creditPackages)
            .orderBy(creditPackages.sortOrder);

        res.json({
            settings: settingsRecord,
            systemSettings: systemSettingsRecord,
            packages,
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.patch('/', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const validationResult = updateSettingsSchema.safeParse(req.body);

        if (!validationResult.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.flatten(),
            });
            return;
        }

        await ensureSettingsRecord();

        const [updated] = await db.update(settings)
            .set({
                ...validationResult.data,
                updatedAt: new Date(),
            })
            .where(eq(settings.id, DEFAULT_ID))
            .returning();

        res.json({
            message: 'Settings updated successfully',
            settings: updated,
        });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/system', requireAuth, requireAdmin, async (_req, res: Response): Promise<void> => {
    try {
        const systemSettingsRecord = await systemSettingsService.getSettings();
        res.json({ systemSettings: systemSettingsRecord });
    } catch (error) {
        console.error('Get system settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.patch('/system', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const validationResult = updateSystemSettingsSchema.safeParse(req.body);

        if (!validationResult.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.flatten(),
            });
            return;
        }

        const normalizedUpdates = {
            ...validationResult.data,
            defaultSearchCountryCode: validationResult.data.defaultSearchCountryCode?.toLowerCase(),
        };

        const systemSettingsRecord = await systemSettingsService.updateSettings(normalizedUpdates);

        res.json({
            message: 'System settings updated successfully',
            systemSettings: systemSettingsRecord,
        });
    } catch (error) {
        console.error('Update system settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const createPackageSchema = z.object({
    name: z.string().min(1),
    credits: z.number().int().positive(),
    price: z.string().regex(/^\d+(\.\d{1,2})?$/),
    description: z.string().nullable().optional(),
    isPopular: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
});

router.post('/packages', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const validationResult = createPackageSchema.safeParse(req.body);

        if (!validationResult.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.flatten(),
            });
            return;
        }

        const [newPackage] = await db.insert(creditPackages)
            .values({
                name: validationResult.data.name,
                credits: validationResult.data.credits,
                price: validationResult.data.price,
                description: validationResult.data.description,
                isPopular: validationResult.data.isPopular ?? false,
                sortOrder: validationResult.data.sortOrder ?? 0,
            })
            .returning();

        res.status(201).json({
            message: 'Package created successfully',
            package: newPackage,
        });
    } catch (error) {
        console.error('Create package error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.patch('/packages/:packageId', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const { packageId } = req.params;
        const validationResult = createPackageSchema.partial().safeParse(req.body);

        if (!validationResult.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.flatten(),
            });
            return;
        }

        const [updated] = await db.update(creditPackages)
            .set({
                ...validationResult.data,
                updatedAt: new Date(),
            })
            .where(eq(creditPackages.id, packageId))
            .returning();

        if (!updated) {
            res.status(404).json({ error: 'Package not found' });
            return;
        }

        res.json({
            message: 'Package updated successfully',
            package: updated,
        });
    } catch (error) {
        console.error('Update package error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/packages/:packageId', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const { packageId } = req.params;

        const [deleted] = await db.delete(creditPackages)
            .where(eq(creditPackages.id, packageId))
            .returning();

        if (!deleted) {
            res.status(404).json({ error: 'Package not found' });
            return;
        }

        res.json({ message: 'Package deleted successfully' });
    } catch (error) {
        console.error('Delete package error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
