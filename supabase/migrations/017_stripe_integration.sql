-- Migration 017: Stripe Connect integration
-- Adds token_balance to users and enriches post_purchases for webhook idempotency.
-- stripe_account_id and stripe_onboarded already exist in the users table.

-- ── users ──────────────────────────────────────────────────────────────────

-- Track how many tokens each user holds (1 token = $1 USD)
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_balance integer NOT NULL DEFAULT 0;

-- Ensure stripe fields exist with correct types (no-ops if already present)
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_account_id  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_onboarded   boolean DEFAULT false;

-- Allow authenticated users to update their own stripe/token fields
GRANT UPDATE(token_balance, stripe_account_id, stripe_onboarded) ON users TO authenticated;

-- ── post_purchases ─────────────────────────────────────────────────────────

-- stripe_session_id lets the webhook handler find the right row idempotently
ALTER TABLE post_purchases ADD COLUMN IF NOT EXISTS stripe_session_id text UNIQUE;

-- status tracks the checkout lifecycle: 'pending' → 'completed'
ALTER TABLE post_purchases ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Edge Functions run as service_role, which already has full access;
-- this grant is a no-op but makes the intent explicit.
GRANT INSERT, UPDATE ON post_purchases TO service_role;
