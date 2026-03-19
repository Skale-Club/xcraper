import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables for storage');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

export type StorageBucket = 'logos' | 'avatars' | 'exports' | 'og-images' | 'testimonials';

export interface UploadResult {
    url: string;
    path: string;
    fullPath: string;
}

export interface UploadOptions {
    bucket: StorageBucket;
    fileName: string;
    fileBuffer: Buffer;
    contentType: string;
    userId?: string;
    upsert?: boolean;
}

const ALLOWED_MIME_TYPES: Record<StorageBucket, string[]> = {
    logos: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'],
    avatars: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    exports: ['application/json', 'text/csv'],
    'og-images': ['image/png', 'image/jpeg', 'image/webp'],
    testimonials: ['image/png', 'image/jpeg', 'image/webp'],
};

const MAX_FILE_SIZES: Record<StorageBucket, number> = {
    logos: 5 * 1024 * 1024,
    avatars: 2 * 1024 * 1024,
    exports: 10 * 1024 * 1024,
    'og-images': 5 * 1024 * 1024,
    testimonials: 5 * 1024 * 1024,
};

function validateFile(bucket: StorageBucket, contentType: string, fileSize: number): void {
    const allowedTypes = ALLOWED_MIME_TYPES[bucket];
    if (!allowedTypes.includes(contentType)) {
        throw new Error(`Invalid file type for ${bucket}. Allowed: ${allowedTypes.join(', ')}`);
    }

    const maxSize = MAX_FILE_SIZES[bucket];
    if (fileSize > maxSize) {
        throw new Error(`File too large for ${bucket}. Max size: ${maxSize / 1024 / 1024}MB`);
    }
}

export async function uploadFile(options: UploadOptions): Promise<UploadResult> {
    const { bucket, fileName, fileBuffer, contentType, userId, upsert = false } = options;

    validateFile(bucket, contentType, fileBuffer.length);

    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = userId
        ? `${userId}/${timestamp}-${sanitizedFileName}`
        : `${timestamp}-${sanitizedFileName}`;

    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, fileBuffer, {
            contentType,
            upsert,
            cacheControl: '3600',
        });

    if (error) {
        console.error('Supabase storage upload error:', error);
        throw new Error(`Failed to upload file: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

    return {
        url: urlData.publicUrl,
        path: data.path,
        fullPath: `${bucket}/${data.path}`,
    };
}

export async function deleteFile(bucket: StorageBucket, path: string): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
        console.error('Supabase storage delete error:', error);
        throw new Error(`Failed to delete file: ${error.message}`);
    }
}

export async function getFileUrl(bucket: StorageBucket, path: string): Promise<string> {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
}

export async function listFiles(bucket: StorageBucket, userId?: string): Promise<string[]> {
    const folder = userId || '';
    
    const { data, error } = await supabase.storage
        .from(bucket)
        .list(folder, {
            limit: 100,
            sortBy: { column: 'created_at', order: 'desc' },
        });

    if (error) {
        console.error('Supabase storage list error:', error);
        throw new Error(`Failed to list files: ${error.message}`);
    }

    return data.map((file) => file.name);
}

export async function ensureBucketsExist(): Promise<void> {
    const buckets: StorageBucket[] = ['logos', 'avatars', 'exports', 'og-images'];

    for (const bucket of buckets) {
        const { data, error } = await supabase.storage.getBucket(bucket);
        
        if (error || !data) {
            console.log(`Creating bucket: ${bucket}`);
            const { error: createError } = await supabase.storage.createBucket(bucket, {
                public: true,
                fileSizeLimit: MAX_FILE_SIZES[bucket],
                allowedMimeTypes: ALLOWED_MIME_TYPES[bucket],
            });

            if (createError) {
                console.error(`Failed to create bucket ${bucket}:`, createError);
            }
        }
    }
}

export { supabase as storageClient };
