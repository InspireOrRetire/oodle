-- Allow threads to exist without an originating post (e.g. profile-level AMA DMs)
ALTER TABLE threads ALTER COLUMN post_id DROP NOT NULL;
