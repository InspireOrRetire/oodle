-- Migration 027: Post view counts
--
-- Adds a `views` column to posts (denormalized, incremented on each view).
-- Uses a SECURITY DEFINER RPC so any authenticated user can increment
-- any post's view count without needing direct UPDATE permission.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;

-- Increment view count for a post.
-- Idempotent: calling it multiple times just keeps adding; the client
-- is responsible for debouncing (call once per page load).
CREATE OR REPLACE FUNCTION increment_post_view(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE posts SET views = views + 1 WHERE id = p_post_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_post_view(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_post_view(UUID) TO anon;
