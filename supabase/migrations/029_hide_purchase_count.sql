-- Allow creators to hide purchase count on their posts and Q&A threads
ALTER TABLE posts    ADD COLUMN IF NOT EXISTS hide_purchase_count boolean NOT NULL DEFAULT false;
ALTER TABLE threads  ADD COLUMN IF NOT EXISTS hide_purchase_count boolean NOT NULL DEFAULT false;
