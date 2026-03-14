
-- Enable Row Level Security
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "search_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_packages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_plans" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to make it idempotent)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 1. Users Table Policies
CREATE POLICY "Users can view own profile" 
ON "users" FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON "users" FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles" 
ON "users" FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 2. Search History Table Policies
CREATE POLICY "Users can view own search history" 
ON "search_history" FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own search history" 
ON "search_history" FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all search history" 
ON "search_history" FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 3. Contacts Table Policies
CREATE POLICY "Users can manage own contacts" 
ON "contacts" FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all contacts" 
ON "contacts" FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 4. Credit Transactions Table Policies
CREATE POLICY "Users can view own transactions" 
ON "credit_transactions" FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all transactions" 
ON "credit_transactions" FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 5. Settings Table Policies
CREATE POLICY "Public can view settings" 
ON "settings" FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage settings" 
ON "settings" FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 6. Credit Packages Table Policies
CREATE POLICY "Public can view credit packages" 
ON "credit_packages" FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage credit packages" 
ON "credit_packages" FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 7. Session Table Policies
-- By default, no access for anon/authenticated roles.
-- Backend uses DATABASE_URL which bypasses RLS.

-- 8. Subscription Plans Table Policies
CREATE POLICY "Public can view active subscription plans" 
ON "subscription_plans" FOR SELECT 
USING (is_active = true AND is_public = true);

CREATE POLICY "Admins can manage subscription plans" 
ON "subscription_plans" FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);
