import { Router, Response, Request } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { uploadFile, deleteFile } from '../services/storage.js';
import { db } from '../db/index.js';
import { settings, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import multer from 'multer';

const router = Router();

interface MulterRequest extends Request {
    file?: Express.Multer.File;
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
});

router.post('/logo', requireAuth, requireAdmin, upload.single('logo'), async (req: MulterRequest, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const result = await uploadFile({
            bucket: 'logos',
            fileName: `logo-${Date.now()}.${req.file.originalname.split('.').pop()}`,
            fileBuffer: req.file.buffer,
            contentType: req.file.mimetype,
            upsert: true,
        });

        await db.update(settings)
            .set({ logoUrl: result.url, updatedAt: new Date() })
            .where(eq(settings.id, 'default'));

        res.json({
            message: 'Logo uploaded successfully',
            url: result.url,
        });
    } catch (error) {
        console.error('Upload logo error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
});

router.post('/favicon', requireAuth, requireAdmin, upload.single('favicon'), async (req: MulterRequest, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const result = await uploadFile({
            bucket: 'logos',
            fileName: `favicon-${Date.now()}.${req.file.originalname.split('.').pop()}`,
            fileBuffer: req.file.buffer,
            contentType: req.file.mimetype,
            upsert: true,
        });

        await db.update(settings)
            .set({ faviconUrl: result.url, updatedAt: new Date() })
            .where(eq(settings.id, 'default'));

        res.json({
            message: 'Favicon uploaded successfully',
            url: result.url,
        });
    } catch (error) {
        console.error('Upload favicon error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
});

router.post('/og-image', requireAuth, requireAdmin, upload.single('ogImage'), async (req: MulterRequest, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const result = await uploadFile({
            bucket: 'og-images',
            fileName: `og-image-${Date.now()}.${req.file.originalname.split('.').pop()}`,
            fileBuffer: req.file.buffer,
            contentType: req.file.mimetype,
            upsert: true,
        });

        await db.update(settings)
            .set({ ogImageUrl: result.url, updatedAt: new Date() })
            .where(eq(settings.id, 'default'));

        res.json({
            message: 'OG Image uploaded successfully',
            url: result.url,
        });
    } catch (error) {
        console.error('Upload OG image error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
});

router.post('/avatar', requireAuth, upload.single('avatar'), async (req: MulterRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const result = await uploadFile({
            bucket: 'avatars',
            fileName: `avatar.${req.file.originalname.split('.').pop()}`,
            fileBuffer: req.file.buffer,
            contentType: req.file.mimetype,
            userId: req.user.id,
            upsert: true,
        });

        await db.update(users)
            .set({ avatarUrl: result.url, updatedAt: new Date() })
            .where(eq(users.id, req.user.id));

        res.json({
            message: 'Avatar uploaded successfully',
            url: result.url,
        });
    } catch (error) {
        console.error('Upload avatar error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
});

router.delete('/avatar', requireAuth, async (req, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const [user] = await db.select({ avatarUrl: users.avatarUrl })
            .from(users)
            .where(eq(users.id, req.user.id))
            .limit(1);

        if (user?.avatarUrl) {
            try {
                const url = new URL(user.avatarUrl);
                const pathParts = url.pathname.split('/');
                const bucketIndex = pathParts.findIndex(p => p === 'avatars');
                if (bucketIndex !== -1) {
                    const filePath = pathParts.slice(bucketIndex + 1).join('/');
                    await deleteFile('avatars', filePath);
                }
            } catch {
                console.warn('Could not parse avatar URL for deletion');
            }
        }

        await db.update(users)
            .set({ avatarUrl: null, updatedAt: new Date() })
            .where(eq(users.id, req.user.id));

        res.json({ message: 'Avatar deleted successfully' });
    } catch (error) {
        console.error('Delete avatar error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
});

router.delete('/logo', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const [settingsRecord] = await db.select({ logoUrl: settings.logoUrl })
            .from(settings)
            .where(eq(settings.id, 'default'))
            .limit(1);

        if (settingsRecord?.logoUrl) {
            try {
                const url = new URL(settingsRecord.logoUrl);
                const pathParts = url.pathname.split('/');
                const bucketIndex = pathParts.findIndex(p => p === 'logos');
                if (bucketIndex !== -1) {
                    const filePath = pathParts.slice(bucketIndex + 1).join('/');
                    await deleteFile('logos', filePath);
                }
            } catch {
                console.warn('Could not parse logo URL for deletion');
            }
        }

        await db.update(settings)
            .set({ logoUrl: null, updatedAt: new Date() })
            .where(eq(settings.id, 'default'));

        res.json({ message: 'Logo deleted successfully' });
    } catch (error) {
        console.error('Delete logo error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
});

router.delete('/favicon', requireAuth, requireAdmin, async (req, res: Response): Promise<void> => {
    try {
        const [settingsRecord] = await db.select({ faviconUrl: settings.faviconUrl })
            .from(settings)
            .where(eq(settings.id, 'default'))
            .limit(1);

        if (settingsRecord?.faviconUrl) {
            try {
                const url = new URL(settingsRecord.faviconUrl);
                const pathParts = url.pathname.split('/');
                const bucketIndex = pathParts.findIndex(p => p === 'logos');
                if (bucketIndex !== -1) {
                    const filePath = pathParts.slice(bucketIndex + 1).join('/');
                    await deleteFile('logos', filePath);
                }
            } catch {
                console.warn('Could not parse favicon URL for deletion');
            }
        }

        await db.update(settings)
            .set({ faviconUrl: null, updatedAt: new Date() })
            .where(eq(settings.id, 'default'));

        res.json({ message: 'Favicon deleted successfully' });
    } catch (error) {
        console.error('Delete favicon error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
});

export default router;
