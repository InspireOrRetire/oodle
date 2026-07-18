-- Remove the wallet/balance system.
-- The token_balance column on users is no longer used — direct Stripe Checkout
-- replaces the pre-load wallet flow. post_purchases remains as the source of
-- truth for who has paid to access which answer.

ALTER TABLE users DROP COLUMN IF EXISTS token_balance;
