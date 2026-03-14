import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { settings, creditPackages } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Get public settings (for landing page - no auth required)
router.get('/public', async (_req, res: Response): Promise<void> => {
    try {
        let [settingsRecord] = await db.select().from(settings).limit(1);

        // Create default settings if none exist
        if (!settingsRecord) {
            [settingsRecord] = await db.insert(settings).values({ id: 'default' }).returning();
        }

        // Get active credit packages
        const packages = await db.select()
            .from(creditPackages)
            .where(eq(creditPackages.isActive, true))
            .orderBy(creditPackages.sortOrder);

        // Return only public settings
        res.json({
            settings: {
                // Branding
                brandName: settingsRecord.brandName,
                brandTagline: settingsRecord.brandTagline,
                brandDescription: settingsRecord.brandDescription,
                logoUrl: settingsRecord.logoUrl,

                // SEO
                seoTitle: settingsRecord.seoTitle,
                seoDescription: settingsRecord.seoDescription,
                seoKeywords: settingsRecord.seoKeywords,
                ogImageUrl: settingsRecord.ogImageUrl,

                // Landing page content
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

                // Feature flags
                registrationEnabled: settingsRecord.registrationEnabled,
                freeCreditsOnSignup: settingsRecord.freeCreditsOnSignup,
            },
            packages: packages.map(pkg => ({
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

// Get all settings (admin only)
router.get('/', requireAuth, requireAdmin, async (_req, res: Response): Promise<void> => {
    try {
        let [settingsRecord] = await db.select().from(settings).limit(1);

        if (!settingsRecord) {
            [settingsRecord] = await db.insert(settings).values({ id: 'default' }).returning();
        }

        const packages = await db.select()
            .from(creditPackages)
            .orderBy(creditPackages.sortOrder);

        res.json({ settings: settingsRecord, packages });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update settings (admin only)
const updateSettingsSchema = z.object({
    // Branding
    brandName: z.string().min(1).optional(),
    brandTagline: z.string().min(1).optional(),
    brandDescription: z.string().min(1).optional(),
    logoUrl: z.string().url().nullable().optional(),
    faviconUrl: z.string().url().nullable().optional(),

    // SEO
    seoTitle: z.string().min(1).optional(),
    seoDescription: z.string().min(1).optional(),
    seoKeywords: z.string().min(1).optional(),
    ogImageUrl: z.string().url().nullable().optional(),
    twitterHandle: z.string().nullable().optional(),

    // Landing page
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

    // Footer
    footerText: z.string().min(1).optional(),
    footerLinks: z.array(z.object({
        label: z.string(),
        url: z.string(),
    })).optional(),
    socialLinks: z.array(z.object({
        platform: z.string(),
        url: z.string(),
    })).optional(),

    // Contact
    contactEmail: z.string().email().nullable().optional(),
    contactPhone: z.string().nullable().optional(),
    contactAddress: z.string().nullable().optional(),

    // Custom code
    googleAnalyticsId: z.string().nullable().optional(),
    customHeadCode: z.string().nullable().optional(),
    customBodyCode: z.string().nullable().optional(),

    // Feature flags
    registrationEnabled: z.boolean().optional(),
    freeCreditsOnSignup: z.number().int().min(0).optional(),
});

router.patch('/', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const validationResult = updateSettingsSchema.safeParse(req.body);

        if (!validationResult.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.flatten()
            });
            return;
        }

        const [updated] = await db.update(settings)
            .set({
                ...validationResult.data,
                updatedAt: new Date(),
            })
            .where(eq(settings.id, 'default'))
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

// Credit Packages CRUD (admin only)
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
                details: validationResult.error.flatten()
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
                details: validationResult.error.flatten()
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
