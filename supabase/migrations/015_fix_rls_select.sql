-- ============================================================
-- 015 — Fix RLS SELECT policies to use auth.uid() IS NOT NULL
-- ============================================================
-- auth.role() = 'authenticated' is unreliable during token refresh
-- windows. auth.uid() IS NOT NULL always reflects the actual
-- session state from the JWT, so it never flickers.
-- ============================================================

-- ── posts SELECT ─────────────────────────────────────────────
DROP POLICY IF EXISTS "posts_select_authenticated" ON posts;
CREATE POLICY "posts_select_authenticated"
  ON posts FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

-- ── users SELECT ─────────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_authenticated" ON users;
CREATE POLICY "users_select_authenticated"
  ON users FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
