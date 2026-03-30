import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// 🔥 Używamy JEDNEGO źródła prawdy — tych samych zmiennych co reszta aplikacji
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 🔒 Walidacja — jeśli czegoś brakuje, zatrzymujemy build
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in Hostinger and redeploy."
  );
}

// 🔥 Jeden, poprawny klient Supabase dla całej aplikacji
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
