-- Migration 025: Backfill followers_count and following_count
--
-- All rows inserted into user_following before migration 024 (which added
-- SECURITY DEFINER to sync_follow_counts) never updated the users table
-- because the trigger was silently blocked by RLS. Recalculate from scratch.

UPDATE users u
SET
  followers_count = (
    SELECT COUNT(*) FROM user_following WHERE creator_id  = u.id
  ),
  following_count = (
    SELECT COUNT(*) FROM user_following WHERE follower_id = u.id
  );
