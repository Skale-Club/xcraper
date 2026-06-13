-- Per-user Xphere integration credentials.
-- The Xphere API key (xph_... with the prospects:write scope) is stored PER USER,
-- not as a global env var, so each user pushes scraped leads into their own Xphere
-- workspace. Configured from the user's profile panel. Idempotent.

ALTER TABLE users ADD COLUMN IF NOT EXISTS xphere_api_key text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS xphere_api_url text;
