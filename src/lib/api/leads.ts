import { supabase } from "@/lib/supabase";

export interface Lead {
  id: string;
  user_id: string | null;
  company_name: string;
  city: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  google_rating: number | null;
  google_reviews: number | null;
  site_score: number | null;
  site_status: string | null;
  site_summary: string | null;
  opportunity: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchLeads() {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Lead[];
}

export async function insertLead(lead: Partial<Lead>) {
  const opportunity = !lead.website || (lead.site_score != null && lead.site_score < 50);
  const row = { ...lead, opportunity } as any;
  const { data, error } = await supabase
    .from("leads")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as Lead;
}

export async function updateLead(id: string, updates: Partial<Lead>) {
  if (updates.site_score != null) {
    updates.opportunity = updates.site_score < 50;
  }
  const { data, error } = await supabase
    .from("leads")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Lead;
}

export async function deleteLead(id: string) {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
}

export async function analyzeWebsite(url: string): Promise<{
  score: number;
  status: string;
  summary: string;
  email?: string | null;
}> {
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-website`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ url }),
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || "Analysis failed");
  }

  return resp.json();
}
