-- ============================================================
-- 032 – Structured post subtypes (recipe & itinerary)
-- Adds post_subtype and structured_data to posts table.
-- post_subtype: 'recipe' | 'itinerary' | NULL (generic post)
-- structured_data: JSONB holding the structured fields
-- ============================================================

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS post_subtype TEXT
    CHECK (post_subtype IN ('recipe', 'itinerary'));

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS structured_data JSONB;

CREATE INDEX IF NOT EXISTS posts_post_subtype_idx
  ON posts (post_subtype, created_at DESC)
  WHERE post_subtype IS NOT NULL;
