import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
    getPlacesAutocompleteSuggestions,
    isGooglePlacesConfigured,
} from '../services/googlePlaces.js';

const router = Router();

const autocompleteQuerySchema = z.object({
    input: z.string().trim().min(3, 'Input must be at least 3 characters'),
    mode: z.enum(['query', 'location']),
});

router.get('/autocomplete', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const validationResult = autocompleteQuerySchema.safeParse(req.query);

        if (!validationResult.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.flatten(),
            });
            return;
        }

        if (!isGooglePlacesConfigured()) {
            res.status(503).json({
                error: 'Google Places autocomplete is not configured.',
            });
            return;
        }

        const { input, mode } = validationResult.data;
        const suggestions = await getPlacesAutocompleteSuggestions(input, mode);

        res.json({ suggestions });
    } catch (error) {
        console.error('Places autocomplete error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to fetch autocomplete suggestions',
        });
    }
});

export default router;
