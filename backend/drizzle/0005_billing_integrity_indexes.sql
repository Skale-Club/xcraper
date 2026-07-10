-- ============================================================================
-- Billing integrity indexes
-- ============================================================================
-- 1) Top-up / refund idempotency backstops: the original 0002 indexes only
--    covered 'purchase' and 'monthly_grant'. Auto top-ups and refund reversals
--    now get the same at-most-one-grant-per-payment-intent guarantee at the
--    database level (the application performs a row-locked existing-transaction
--    check first; these are belt-and-suspenders).
--
-- 2) Unique Stripe references on users: findUserByStripeReference
--    (routes/subscriptions.ts) resolves webhook grants by stripe_customer_id /
--    stripe_subscription_id with LIMIT 1, so a duplicate row would silently
--    credit the wrong user.
--
-- IMPORTANT: if historical duplicates exist, index creation will FAIL. Inspect
-- and de-duplicate first, e.g.:
--
--   SELECT stripe_customer_id, count(*) FROM users
--   WHERE stripe_customer_id IS NOT NULL
--   GROUP BY 1 HAVING count(*) > 1;
--
--   SELECT stripe_payment_intent_id, count(*) FROM credit_transactions
--   WHERE type = 'top_up' AND stripe_payment_intent_id IS NOT NULL
--   GROUP BY 1 HAVING count(*) > 1;
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS "credit_transactions_top_up_payment_intent_unique"
    ON "credit_transactions" ("stripe_payment_intent_id")
    WHERE "type" = 'top_up' AND "stripe_payment_intent_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "credit_transactions_refund_payment_intent_unique"
    ON "credit_transactions" ("stripe_payment_intent_id")
    WHERE "type" = 'refund' AND "stripe_payment_intent_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_stripe_customer_id_unique"
    ON "users" ("stripe_customer_id")
    WHERE "stripe_customer_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_stripe_subscription_id_unique"
    ON "users" ("stripe_subscription_id")
    WHERE "stripe_subscription_id" IS NOT NULL;

-- Contacts dedupe lookups: consumeCredits (services/creditRules.ts) filters by
-- user + dedupe_key + created_at on every finalized search; without an index
-- this is a sequential scan that grows with the contacts table.
CREATE INDEX IF NOT EXISTS "contacts_user_dedupe_key_idx"
    ON "contacts" ("user_id", "dedupe_key")
    WHERE "dedupe_key" IS NOT NULL;
