
-- Images table for gallery
CREATE TABLE public.images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  url text NOT NULL,
  prompt text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view images" ON public.images FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert images" ON public.images FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can delete images" ON public.images FOR DELETE TO public USING (true);

-- Videos table for video pro gallery
CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  url text NOT NULL,
  prompt text NOT NULL,
  style text,
  duration integer,
  ratio text,
  resolution text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view videos" ON public.videos FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert videos" ON public.videos FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can delete videos" ON public.videos FOR DELETE TO public USING (true);
