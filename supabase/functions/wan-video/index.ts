import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HF_SPACE = "https://webnova-wan2-2-fp8da-aoti-preview2.hf.space";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { image, prompt, duration, fps, safe_mode } = body;

    if (!image) {
      return new Response(
        JSON.stringify({ error: "input image is required (base64 data URI or URL)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageData: Record<string, unknown> = {
      url: image,
      meta: { _type: "gradio.FileData" },
    };

    const payload = {
      input_image: imageData,
      last_image: imageData,
      prompt: prompt || "make this image come alive, cinematic motion, smooth animation",
      steps: 6,
      negative_prompt: "blurry, low quality, distorted",
      duration_seconds: typeof duration === "number" ? Math.min(Math.max(duration, 0.5), 10) : 3.5,
      guidance_scale: 1.0,
      guidance_scale_2: 1.0,
      seed: 0,
      randomize_seed: true,
      quality: 5,
      scheduler: "FlowMatchEulerDiscrete",
      flow_shift: 7.0,
      frame_multiplier: typeof fps === "number" ? String(fps) : "16",
      safe_mode: safe_mode ?? false,
      video_component: true,
    };

    console.log("Calling Wan 2.2 I2V...");

    const res = await fetch(`${HF_SPACE}/gradio_api/run/generate_video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(300000), // 5 min for video gen
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Wan API error:", res.status, errText);
      return new Response(
        JSON.stringify({ error: `Video generation failed: ${res.status}`, details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    console.log("Wan response keys:", Object.keys(data));

    // Extract video URL from Gradio response
    let videoUrl: string | null = null;

    // output or output_1 contains the video file
    const output = data?.output ?? data?.output_1;
    if (output?.url) {
      videoUrl = output.url.startsWith("http") ? output.url : `${HF_SPACE}/gradio_api/file=${output.url}`;
    } else if (output?.path) {
      videoUrl = `${HF_SPACE}/gradio_api/file=${output.path}`;
    }

    // Also check data array format (older Gradio)
    if (!videoUrl && Array.isArray(data?.data)) {
      const first = data.data[0];
      if (typeof first === "string") videoUrl = first;
      else if (first?.url) videoUrl = first.url;
      else if (first?.path) videoUrl = `${HF_SPACE}/gradio_api/file=${first.path}`;
    }

    if (!videoUrl) {
      console.error("No video URL in response:", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "No video URL in response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ video_url: videoUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("wan-video error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
