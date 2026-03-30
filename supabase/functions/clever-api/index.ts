import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Polling aż wideo będzie gotowe
async function pollUntilDone(
  baseUrl: string,
  taskId: string,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${baseUrl}/status/${taskId}`);
    if (!res.ok) throw new Error(`Status check failed: ${res.status}`);

    const data = await res.json();

    if (data.status === "done" && data.video_url) {
      return data.video_url;
    }

    if (data.status === "error") {
      throw new Error(`Video generation failed: ${data.error}`);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Video generation timed out");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const baseUrl = Deno.env.get("NEXUS_VIDEO_API");
    if (!baseUrl) {
      return new Response(
        JSON.stringify({ error: "NEXUS_VIDEO_API not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 1) Start zadania
    const startRes = await fetch(`${baseUrl}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!startRes.ok) {
      const err = await startRes.text();
      return new Response(
        JSON.stringify({ error: "Video start failed", details: err }),
        { status: 500, headers: corsHeaders }
      );
    }

    const startData = await startRes.json();
    const taskId = startData.task_id;

    if (!taskId) {
      return new Response(
        JSON.stringify({ error: "No task_id returned from backend" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 2) Polling
    const videoUrl = await pollUntilDone(baseUrl, taskId);

    return new Response(
      JSON.stringify({ video_url: videoUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
