-- ============================================================
-- Fix 1: Allow any authenticated user to insert their own users row
--         (backfill + INSERT policy)
-- ============================================================
CREATE POLICY IF NOT EXISTS "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Backfill any auth.users rows missing from public.users
INSERT INTO public.users (id, email, role)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'role', 'creator')::text
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Fix 2: Allow any authenticated user to create posts
--         (not just users with role = 'creator')
--         The old policy blocked users whose row didn't exist yet
--         or whose role was 'fan'.
-- ============================================================
DROP POLICY IF EXISTS "posts_insert_creator_only" ON posts;

CREATE POLICY "posts_insert_own"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- ============================================================
-- Fix 3: Storage buckets for avatars and post-images
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',     'avatars',     true, 5242880,  ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('post-images', 'post-images', true, 20971520, ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: avatars
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'avatars_public_read' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'avatars_auth_insert' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "avatars_auth_insert" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'avatars_auth_update' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "avatars_auth_update" ON storage.objects FOR UPDATE
      USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;

-- Storage RLS: post-images
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'post_images_public_read' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "post_images_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'post-images');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'post_images_auth_insert' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "post_images_auth_insert" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'post-images' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'post_images_auth_update' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "post_images_auth_update" ON storage.objects FOR UPDATE
      USING (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
