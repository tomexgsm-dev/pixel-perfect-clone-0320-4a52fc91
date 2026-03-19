
-- Add attachment columns to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload to chat-attachments
CREATE POLICY "Anyone can upload chat attachments"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'chat-attachments');

-- Allow anyone to read chat attachments
CREATE POLICY "Anyone can read chat attachments"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'chat-attachments');
