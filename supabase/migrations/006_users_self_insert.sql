-- ============================================================
-- Allow authenticated users to insert their own users row
-- (fallback for when the handle_new_user trigger missed a signup)
-- ============================================================

-- Add self-insert RLS policy so upsert works from the client
CREATE POLICY IF NOT EXISTS "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Backfill any auth.users rows that are missing from public.users
INSERT INTO public.users (id, email, role)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'role', 'fan')::text
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO NOTHING;
