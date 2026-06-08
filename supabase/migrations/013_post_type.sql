-- ============================================================
-- 013 – Post Type & Fixed Price
-- Adds post_type and fixed_price to the posts table.
-- post_type drives CTA rendering on feed cards:
--   type1 = open-ended post (Ask a question only)
--   type2 = fixed price answer post (I want this + Ask a question)
-- ============================================================

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS post_type TEXT
    CHECK (post_type IN ('type1', 'type2'))
    NOT NULL DEFAULT 'type1';

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS fixed_price NUMERIC(10,2);

-- Backfill: posts that already have a price > 0 are effectively type2
UPDATE posts
   SET post_type   = 'type2',
       fixed_price = price
 WHERE price IS NOT NULL AND price > 0;

-- Index for filtering by type in feeds
CREATE INDEX IF NOT EXISTS posts_post_type_idx
  ON posts (post_type, created_at DESC);
