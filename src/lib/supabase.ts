import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Używamy PUBLISHABLE_KEY, a jeśli go nie ma — ANON_KEY
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

// Klient Supabase
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/* ---------- AUTO LOGIN (ANON) ---------- */
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
