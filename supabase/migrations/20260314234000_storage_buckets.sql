-- Storage Buckets for Xcraper

-- Insert storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('logos', 'logos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon']),
    ('avatars', 'avatars', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
    ('exports', 'exports', false, 10485760, ARRAY['application/json', 'text/csv']),
    ('og-images', 'og-images', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Policies for logos bucket (public read, admin write)
CREATE POLICY "Public read access for logos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'logos');

CREATE POLICY "Admin write access for logos"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'logos'
        AND (
            EXISTS (
                SELECT 1 FROM users
                WHERE users.id = auth.uid()
                AND users.role = 'admin'
            )
            OR auth.jwt() ->> 'role' = 'service_role'
        )
    );

CREATE POLICY "Admin delete access for logos"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'logos'
        AND (
            EXISTS (
                SELECT 1 FROM users
                WHERE users.id = auth.uid()
                AND users.role = 'admin'
            )
            OR auth.jwt() ->> 'role' = 'service_role'
        )
    );

-- Policies for avatars bucket (public read, owner write)
CREATE POLICY "Public read access for avatars"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete own avatar"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Policies for og-images bucket (public read, admin write)
CREATE POLICY "Public read access for og-images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'og-images');

CREATE POLICY "Admin write access for og-images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'og-images'
        AND (
            EXISTS (
                SELECT 1 FROM users
                WHERE users.id = auth.uid()
                AND users.role = 'admin'
            )
            OR auth.jwt() ->> 'role' = 'service_role'
        )
    );

CREATE POLICY "Admin delete access for og-images"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'og-images'
        AND (
            EXISTS (
                SELECT 1 FROM users
                WHERE users.id = auth.uid()
                AND users.role = 'admin'
            )
            OR auth.jwt() ->> 'role' = 'service_role'
        )
    );

-- Policies for exports bucket (owner only)
CREATE POLICY "Users can read own exports"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'exports'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can create own exports"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'exports'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete own exports"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'exports'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
