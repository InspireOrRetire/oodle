-- ============================================================
-- 014 — Grant table permissions to anon + authenticated roles
-- The previous migrations created RLS policies but forgot to
-- GRANT the underlying table access. Without this, all queries
-- return "permission denied" regardless of RLS policies.
-- ============================================================

-- ── users ─────────────────────────────────────────────────────
GRANT SELECT                       ON public.users             TO anon;
GRANT SELECT, INSERT, UPDATE       ON public.users             TO authenticated;

-- ── posts ─────────────────────────────────────────────────────
GRANT SELECT                       ON public.posts             TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts           TO authenticated;

-- ── threads ───────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE       ON public.threads           TO authenticated;

-- ── messages ──────────────────────────────────────────────────
GRANT SELECT, INSERT               ON public.messages          TO authenticated;

-- ── post_purchases ────────────────────────────────────────────
GRANT SELECT, INSERT               ON public.post_purchases    TO authenticated;

-- ── user_following ────────────────────────────────────────────
GRANT SELECT                       ON public.user_following    TO anon;
GRANT SELECT, INSERT, DELETE       ON public.user_following    TO authenticated;

-- ── notifications ─────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications   TO authenticated;

-- ── saved_collections ─────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_collections TO authenticated;

-- ── profile_questions ─────────────────────────────────────────
GRANT SELECT                         ON public.profile_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_questions TO authenticated;

-- ── sequences (needed for any SERIAL / auto-increment columns) ─
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
