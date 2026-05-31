-- ============================================================================
-- Stripe grant idempotency indexes (defense-in-depth)
-- ============================================================================
-- These partial UNIQUE indexes guarantee, at the database level, that a single
-- Stripe payment intent (one-time purchase) and a single Stripe invoice
-- (subscription renewal) can each produce at most one credit grant — even if a
-- webhook is delivered more than once or races the /verify endpoint.
--
-- The application code (services/stripe.ts, routes/subscriptions.ts) already
-- performs the grant inside a row-locked transaction that re-checks for an
-- existing grant, so new duplicates can no longer be created. These indexes are
-- the belt-and-suspenders backstop.
--
-- IMPORTANT: if the table already contains historical duplicates (created before
-- the code fix), creating these indexes will FAIL. De-duplicate first, keeping a
-- single row per key, e.g.:
--
--   DELETE FROM credit_transactions a USING credit_transactions b
--   WHERE a.ctid < b.ctid
--     AND a.type = 'purchase' AND b.type = 'purchase'
--     AND a.stripe_payment_intent_id = b.stripe_payment_intent_id
--     AND a.stripe_payment_intent_id IS NOT NULL;
--
--   DELETE FROM credit_transactions a USING credit_transactions b
--   WHERE a.ctid < b.ctid
--     AND a.type = 'monthly_grant' AND b.type = 'monthly_grant'
--     AND a.stripe_invoice_id = b.stripe_invoice_id
--     AND a.stripe_invoice_id IS NOT NULL;
--
-- (Review affected rows before deleting; adjust the credit balances if any
-- duplicate grants were actually applied to a user.)
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS "credit_transactions_purchase_payment_intent_unique"
    ON "credit_transactions" ("stripe_payment_intent_id")
    WHERE "type" = 'purchase' AND "stripe_payment_intent_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "credit_transactions_monthly_grant_invoice_unique"
    ON "credit_transactions" ("stripe_invoice_id")
    WHERE "type" = 'monthly_grant' AND "stripe_invoice_id" IS NOT NULL;
