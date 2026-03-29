
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  city TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  google_rating NUMERIC(2,1),
  google_reviews INTEGER,
  site_score INTEGER,
  site_status TEXT CHECK (site_status IN ('good', 'average', 'bad')),
  site_summary TEXT,
  opportunity BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view leads" ON public.leads FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert leads" ON public.leads FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update leads" ON public.leads FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete leads" ON public.leads FOR DELETE TO public USING (true);
