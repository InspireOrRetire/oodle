-- Migration 021: Allow balance-based unlocks without a thread
--
-- post_purchases was originally designed for Stripe per-thread purchases.
-- The wallet model allows unlocking directly from balance without a thread.
-- Make thread_id and creator_id nullable, add (post_id, buyer_id) uniqueness
-- so a buyer can't purchase the same post twice regardless of payment method.

ALTER TABLE post_purchases ALTER COLUMN thread_id  DROP NOT NULL;
ALTER TABLE post_purchases ALTER COLUMN creator_id DROP NOT NULL;

-- Prevent double-purchasing the same post
ALTER TABLE post_purchases
  ADD CONSTRAINT post_purchases_post_buyer_unique
  UNIQUE (post_id, buyer_id);
