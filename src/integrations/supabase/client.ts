import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/* ---------- AUTO LOGIN ---------- */

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

