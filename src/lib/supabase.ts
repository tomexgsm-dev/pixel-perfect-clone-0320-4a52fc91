import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/* ---------------------------------------------
   SUPABASE CONFIG
---------------------------------------------- */

// URL projektu Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Klucz publiczny (preferowany publishable, fallback na anon)
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

// Tworzymy klienta Supabase
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/* ---------------------------------------------
   AUTO-LOGIN (ANON SESSION)
---------------------------------------------- */

async function ensureSession() {
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    try {
      await supabase.auth.signInAnonymously();
      console.log("Supabase anonymous session created");
    } catch (err) {
      console.error("Supabase auth error", err);
    }
  }
}

ensureSession();
