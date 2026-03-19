
-- Profiles table with plan & usage limits
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  free_images_left integer NOT NULL DEFAULT 5,
  free_chat_left integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update conversations RLS to user-scoped
DROP POLICY IF EXISTS "Anyone can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Anyone can delete conversations" ON public.conversations;
DROP POLICY IF EXISTS "Anyone can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Anyone can view conversations" ON public.conversations;

CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON public.conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Messages RLS - user owns conversation
DROP POLICY IF EXISTS "Anyone can create messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can delete messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can update messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can view messages" ON public.messages;

CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversations WHERE id = messages.conversation_id AND user_id = auth.uid()));
CREATE POLICY "Users can create own messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.conversations WHERE id = messages.conversation_id AND user_id = auth.uid()));
CREATE POLICY "Users can update own messages" ON public.messages FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.conversations WHERE id = messages.conversation_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own messages" ON public.messages FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.conversations WHERE id = messages.conversation_id AND user_id = auth.uid()));

-- Generated images RLS
DROP POLICY IF EXISTS "Anyone can create images" ON public.generated_images;
DROP POLICY IF EXISTS "Anyone can delete images" ON public.generated_images;
DROP POLICY IF EXISTS "Anyone can view images" ON public.generated_images;

CREATE POLICY "Users can view own images" ON public.generated_images FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own images" ON public.generated_images FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own images" ON public.generated_images FOR DELETE TO authenticated USING (auth.uid() = user_id);
