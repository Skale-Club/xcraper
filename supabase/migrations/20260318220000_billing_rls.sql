ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own billing events" ON public.billing_events;
DROP POLICY IF EXISTS "Admins can manage all billing events" ON public.billing_events;
DROP POLICY IF EXISTS "Users can view own billing alerts" ON public.billing_alerts;
DROP POLICY IF EXISTS "Admins can manage all billing alerts" ON public.billing_alerts;
DROP POLICY IF EXISTS "Users can view own usage summary" ON public.usage_summary;
DROP POLICY IF EXISTS "Admins can manage all usage summary" ON public.usage_summary;

CREATE POLICY "Users can view own billing events"
    ON public.billing_events
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all billing events"
    ON public.billing_events
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

CREATE POLICY "Users can view own billing alerts"
    ON public.billing_alerts
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all billing alerts"
    ON public.billing_alerts
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

CREATE POLICY "Users can view own usage summary"
    ON public.usage_summary
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all usage summary"
    ON public.usage_summary
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
