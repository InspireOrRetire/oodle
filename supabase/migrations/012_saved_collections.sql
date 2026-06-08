-- ============================================================
-- 012 – Saved Collections & Items
-- ============================================================

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_collections (
  collection_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_collections_user_idx
  ON saved_collections (user_id, created_at DESC);

-- Items can belong to one collection (null = "All Saved" / uncollected)
CREATE TABLE IF NOT EXISTS saved_items (
  saved_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id        UUID        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  collection_id  UUID        REFERENCES saved_collections(collection_id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)   -- one save-row per user per post
);

CREATE INDEX IF NOT EXISTS saved_items_user_idx
  ON saved_items (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS saved_items_collection_idx
  ON saved_items (collection_id);

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE saved_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items       ENABLE ROW LEVEL SECURITY;

-- Collections: own data only
CREATE POLICY "users manage own collections"
  ON saved_collections FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Items: own data only
CREATE POLICY "users manage own saved items"
  ON saved_items FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
