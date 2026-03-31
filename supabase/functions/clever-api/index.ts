// v2 - uses NEXUS_VIDEO_API (HuggingFace backend)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    const prompt = body?.prompt ?? "";
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "prompt is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const baseUrl = Deno.env.get("NEXUS_VIDEO_API");
    if (!baseUrl) {
      return new Response(
        JSON.stringify({ error: "NEXUS_VIDEO_API not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const allowedModes = [
      "tiktok",
      "social",
      "cinematic",
      "ads",
      "music",
      "music_long",
      "experimental",
    ];

    const mode = (body?.mode ?? "cinematic").toLowerCase();
    const selectedMode = allowedModes.includes(mode) ? mode : "cinematic";
    const startEndpoint = `${baseUrl}/video/${selectedMode}`;

    const payload: Record<string, unknown> = { prompt };
    if (typeof body?.duration === "number") {
      payload["duration_seconds"] = body.duration;
    }

    const startRes = await fetch(startEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!startRes.ok) {
      const err = await startRes.text();
      return new Response(
        JSON.stringify({
          error: `Video start failed: ${startRes.status}`,
          details: err,
        }),
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

    const videoUrl = await pollUntilDone(baseUrl, taskId);

    return new Response(
      JSON.stringify({ video_url: videoUrl, task_id: taskId }),
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
