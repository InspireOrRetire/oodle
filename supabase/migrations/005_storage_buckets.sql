-- ============================================================
-- Storage buckets for avatars and post images
-- ============================================================

-- Create buckets (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',     'avatars',     true, 5242880,  ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('post-images', 'post-images', true, 20971520, ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4'])
ON CONFLICT (id) DO NOTHING;

-- ── RLS: avatars ──────────────────────────────────────────────────────────────

-- Anyone can view avatars
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can upload their own avatar
CREATE POLICY "avatars_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update/delete only their own avatar
CREATE POLICY "avatars_auth_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_auth_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── RLS: post-images ─────────────────────────────────────────────────────────

-- Anyone can view post images
CREATE POLICY "post_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-images');

-- Authenticated creators can upload post images
CREATE POLICY "post_images_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'post-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Creators can update/delete their own post images
CREATE POLICY "post_images_auth_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "post_images_auth_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
