
-- Create videos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public uploads to videos bucket
CREATE POLICY "Anyone can upload videos"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'videos');

-- Allow public reads from videos bucket
CREATE POLICY "Anyone can read videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'videos');

-- Allow public deletes from videos bucket
CREATE POLICY "Anyone can delete videos"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'videos');
