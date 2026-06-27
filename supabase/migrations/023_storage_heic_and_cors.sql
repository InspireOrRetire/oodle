-- Allow HEIC/HEIF from iOS cameras and increase size limit to 50MB
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'image/gif', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime',
    'application/pdf'
  ],
  file_size_limit = 52428800
WHERE id = 'post-images';
