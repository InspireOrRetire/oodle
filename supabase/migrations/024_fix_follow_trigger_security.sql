-- Migration 024: Fix follow-count trigger to run with SECURITY DEFINER
--
-- Without SECURITY DEFINER, the trigger runs under the calling user's RLS
-- context. The `users_update_own` policy blocks the UPDATE on the creator's
-- row (followers_count), so follower counts never persisted to the DB.
-- SECURITY DEFINER makes the function run as its owner (postgres / service
-- role), bypassing RLS on the users table entirely, which is correct here
-- because maintaining denormalised counts is an internal bookkeeping concern.

CREATE OR REPLACE FUNCTION sync_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.creator_id;
    UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.creator_id;
    UPDATE users SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$;
