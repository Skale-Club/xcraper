-- Fix infinite recursion in admin RLS policies.
--
-- The original "Admins can manage X" policies subquery public.users to check
-- if auth.uid() is admin. The policy on users itself does the same subquery,
-- so any read on users (or any table whose admin policy subqueries users)
-- triggers Postgres error 42P17 "infinite recursion detected in policy".
--
-- Fix: route the admin check through a SECURITY DEFINER function that
-- bypasses RLS when reading users.role. Re-create every admin policy to
-- use it.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- users
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.users;
CREATE POLICY "Admins can manage all profiles"
    ON public.users FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- search_history
DROP POLICY IF EXISTS "Admins can manage all search history" ON public.search_history;
CREATE POLICY "Admins can manage all search history"
    ON public.search_history FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- contacts
DROP POLICY IF EXISTS "Admins can manage all contacts" ON public.contacts;
CREATE POLICY "Admins can manage all contacts"
    ON public.contacts FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- credit_transactions
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.credit_transactions;
CREATE POLICY "Admins can manage all transactions"
    ON public.credit_transactions FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- settings
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
CREATE POLICY "Admins can manage settings"
    ON public.settings FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- credit_packages
DROP POLICY IF EXISTS "Admins can manage credit packages" ON public.credit_packages;
CREATE POLICY "Admins can manage credit packages"
    ON public.credit_packages FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- subscription_plans
DROP POLICY IF EXISTS "Admins can manage subscription plans" ON public.subscription_plans;
CREATE POLICY "Admins can manage subscription plans"
    ON public.subscription_plans FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- billing_events
DROP POLICY IF EXISTS "Admins can manage all billing events" ON public.billing_events;
CREATE POLICY "Admins can manage all billing events"
    ON public.billing_events FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- billing_alerts
DROP POLICY IF EXISTS "Admins can manage all billing alerts" ON public.billing_alerts;
CREATE POLICY "Admins can manage all billing alerts"
    ON public.billing_alerts FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- usage_summary
DROP POLICY IF EXISTS "Admins can manage all usage summary" ON public.usage_summary;
CREATE POLICY "Admins can manage all usage summary"
    ON public.usage_summary FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- system_settings
DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;
CREATE POLICY "Admins can manage system settings"
    ON public.system_settings FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
