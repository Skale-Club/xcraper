-- Enable RLS on scraper_templates (advisor: 0013_rls_disabled_in_public).
--
-- The table is exposed to PostgREST, so without RLS the anon key could read and
-- rewrite actor IDs, costs and credit pricing. Nothing reads it via PostgREST:
-- the backend goes through DATABASE_URL as the table owner (RLS is bypassed) and
-- the frontend only sees it via /api/settings/scrapers behind requireAdmin.
--
-- Admin-only, routed through public.is_admin() to avoid the 42P17 recursion
-- described in 20260426130000_fix_admin_rls_recursion.sql.

ALTER TABLE public.scraper_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage scraper templates" ON public.scraper_templates;

CREATE POLICY "Admins can manage scraper templates"
    ON public.scraper_templates FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
