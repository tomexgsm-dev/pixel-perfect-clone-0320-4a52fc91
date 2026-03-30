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
    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "prompt is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const baseUrl = Deno.env.get("NEXUS_VIDEO_API");
    if (!baseUrl) {
      return new Response(
        JSON.stringify({ error: "NEXUS_VIDEO_API not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // mapowanie trybu na endpoint backendu
    const mode = (body?.mode as string | undefined)?.toLowerCase() || "cinematic";
    const allowedModes = [
      "tiktok",
      "social",
      "cinematic",
      "ads",
      "music",
      "music_long",
      "experimental",
    ];
    const selectedMode = allowedModes.includes(mode) ? mode : "cinematic";

    const endpoint = `${baseUrl}/video/${selectedMode}`;

    // payload do backendu (backend używa prompt + opcjonalnie duration_seconds)
    const payload: Record<string, unknown> = {
      prompt,
    };

    if (typeof body?.duration === "number") {
      payload["duration_seconds"] = body.duration;
    }

    // start zadania
    const startRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!startRes.ok) {
      const errText = await startRes.text();
      return new Response(
        JSON.stringify({
          error: `Video start failed: ${startRes.status}`,
          details: errText,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const startData = await startRes.json();
    const taskId = startData.task_id as string | undefined;

    if (!taskId) {
      return new Response(
        JSON.stringify({ error: "No task_id returned from video API" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // polling aż wideo będzie gotowe
    const videoUrl = await pollUntilDone(baseUrl, taskId);

    return new Response(
      JSON.stringify({ video_url: videoUrl, task_id: taskId }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
