-- Track successful Xphere pushes per run so the service API's auto-push can
-- retry until a push actually succeeds, instead of firing only on the single
-- poll where the run transitions to completed. Idempotent.

ALTER TABLE search_history ADD COLUMN IF NOT EXISTS xphere_pushed_at timestamp;
