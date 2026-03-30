// Supabase Edge Function: clever-api
// Wklej ten kod w Supabase Dashboard → Edge Functions → clever-api → Edit

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Czeka aż wideo będzie gotowe (max 5 minut)
async function pollUntilDone(
  baseUrl: string,
  taskId: string,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${baseUrl}/video/status/${taskId}`);
    if (!res.ok) throw new Error(`Status check failed: ${res.status}`);

    const data = await res.json();

    if (data.status === "done" && data.ready) {
      return `${baseUrl}/video/${taskId}`;
    }

    if (data.status === "error") {
      throw new Error(`Video generation failed: ${data.error}`);
    }

    // czekaj przed następnym sprawdzeniem
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("Timeout: video generation took too long");
}

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const NEXUS_VIDEO_API = Deno.env.get("NEXUS_VIDEO_API");
    if (!NEXUS_VIDEO_API) {
      throw new Error("NEXUS_VIDEO_API secret is not configured");
    }

    const body = await req.json();
    const { prompt, avatar, voice, scenes, style, duration, mode } = body;

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Wybierz endpoint na podstawie template/style/mode
    // tiktok, social, cinematic, ads, music, experimental
    let endpoint = "cinematic"; // domyślny

    if (style === "tiktok" || mode === "tiktok")   endpoint = "tiktok";
    else if (style === "social")                    endpoint = "social";
    else if (style === "ads" || mode === "ad")      endpoint = "ads";
    else if (style === "music")                     endpoint = "music";
    else if (style === "cinematic")                 endpoint = "cinematic";

    // Jeśli są sceny — połącz je z promptem
    let finalPrompt = prompt;
    if (Array.isArray(scenes) && scenes.length > 0) {
      const sceneTexts = scenes
        .map((s: { text: string }, i: number) => `Scene ${i + 1}: ${s.text}`)
        .filter((s: string) => s.trim() !== `Scene ${scenes.indexOf}: `);
      if (sceneTexts.length > 0) {
        finalPrompt = `${prompt}\n\n${sceneTexts.join("\n")}`;
      }
    }

    // 1. Wyślij żądanie do Nexus Video API
    const startRes = await fetch(`${NEXUS_VIDEO_API}/video/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: finalPrompt,
        duration_seconds: duration || 10,
      }),
    });

    if (!startRes.ok) {
      const errText = await startRes.text();
      throw new Error(`Nexus API error: ${startRes.status} — ${errText}`);
    }

    const { task_id } = await startRes.json();
    if (!task_id) throw new Error("No task_id returned from Nexus API");

    // 2. Polluj status aż wideo będzie gotowe
    const videoUrl = await pollUntilDone(NEXUS_VIDEO_API, task_id);

    return new Response(
      JSON.stringify({ video_url: videoUrl, task_id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("clever-api error:", message);

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
