ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;

CREATE POLICY "Admins can manage system settings"
    ON public.system_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.users
            WHERE users.id = auth.uid()
              AND users.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.users
            WHERE users.id = auth.uid()
              AND users.role = 'admin'
        )
    );
