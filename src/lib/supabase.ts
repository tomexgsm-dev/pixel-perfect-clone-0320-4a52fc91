import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY =
 (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
 (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

if (!SUPABASE_URL || !SUPABASE_KEY) {
 throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_*_KEY (set in Horizons and redeploy).");
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
 auth: {
 persistSession: true,
 autoRefreshToken: true,
 detectSessionInUrl: true,
 },
});
