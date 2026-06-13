-- A fan should be able to ask multiple questions on the same post (multiple threads).
-- The unique constraint on (post_id, fan_id) was too restrictive.
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_post_id_fan_id_key;
