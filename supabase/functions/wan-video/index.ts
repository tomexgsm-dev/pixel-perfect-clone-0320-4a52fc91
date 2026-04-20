import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HF_SPACE = "https://webnowa-wan2-2-fp8da-aoti-preview2.hf.space";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Diagnostic endpoint to verify HF_KEY validity from runtime secrets
  const url = new URL(req.url);
  if (url.searchParams.get("debug") === "1") {
    const HF_KEY = Deno.env.get("HF_KEY");
    if (!HF_KEY) {
      return new Response(JSON.stringify({ ok: false, reason: "HF_KEY not set in runtime" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const who = await fetch("https://huggingface.co/api/whoami-v2", {
      headers: { Authorization: `Bearer ${HF_KEY}` },
    });
    const whoText = await who.text();
    return new Response(JSON.stringify({
      ok: who.ok,
      status: who.status,
      key_len: HF_KEY.length,
      key_prefix: HF_KEY.slice(0, 4),
      whoami: whoText.slice(0, 600),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    // Gradio /call API expects parameters as a positional array (data)
    const payload = {
      data: [
        imageData,                                                                      // input_image
        imageData,                                                                      // last_image (use same image)
        prompt || "make this image come alive, cinematic motion, smooth animation",     // prompt
        6,                                                                              // steps
        "blurry, low quality, distorted, ugly, deformed",                               // negative_prompt
        typeof duration === "number" ? Math.min(Math.max(duration, 0.5), 10) : 3.5,     // duration_seconds
        1,                                                                              // guidance_scale
        1,                                                                              // guidance_scale_2
        0,                                                                              // seed
        true,                                                                           // randomize_seed
        5,                                                                              // quality
        "FlowMatchEulerDiscrete",                                                       // scheduler
        7.0,                                                                            // flow_shift
        typeof fps === "number" ? String(fps) : "16",                                   // frame_multiplier
        safe_mode ?? false,                                                             // safe_mode
        true,                                                                           // video_component
      ],
    };

    console.log("Calling Wan 2.2 I2V (step 1: submit job)...");

    // ZeroGPU spaces require HF token with quota
    const HF_KEY = Deno.env.get("HF_KEY");
    const authHeaders: Record<string, string> = HF_KEY
      ? { Authorization: `Bearer ${HF_KEY}` }
      : {};

    // Step 1: Submit job, receive event_id
    const submitRes = await fetch(`${HF_SPACE}/gradio_api/call/generate_video`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      console.error("Wan submit error:", submitRes.status, errText.slice(0, 500));
      return new Response(
        JSON.stringify({ error: `Submit failed: ${submitRes.status}`, details: errText.slice(0, 500) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const submitData = await submitRes.json();
    const eventId = submitData?.event_id;
    if (!eventId) {
      console.error("No event_id from submit:", submitData);
      return new Response(
        JSON.stringify({ error: "No event_id received from Wan API" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Got event_id:", eventId, "— polling SSE for result...");

    // Step 2: Poll SSE stream for completion
    const resultRes = await fetch(`${HF_SPACE}/gradio_api/call/generate_video/${eventId}`, {
      method: "GET",
      headers: authHeaders,
      signal: AbortSignal.timeout(300000), // 5 min for video gen
    });

    if (!resultRes.ok) {
      const errText = await resultRes.text();
      console.error("Wan SSE error:", resultRes.status, errText.slice(0, 500));
      return new Response(
        JSON.stringify({ error: `Video generation failed: ${resultRes.status}`, details: errText.slice(0, 500) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse SSE stream
    const sseText = await resultRes.text();
    console.log("SSE response (first 500 chars):", sseText.slice(0, 500));

    // SSE format: lines starting with "event:" and "data:"
    let videoUrl: string | null = null;
    const lines = sseText.split("\n");
    let lastDataLine = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("data:")) {
        lastDataLine = line.slice(5).trim();
      }
      if (line.startsWith("event: complete") || line.startsWith("event:complete")) {
        // next data: line is the result
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].startsWith("data:")) {
            lastDataLine = lines[j].slice(5).trim();
            break;
          }
        }
        break;
      }
    }

    if (lastDataLine) {
      try {
        const parsed = JSON.parse(lastDataLine);
        // Result is array: [video_obj, download_obj, seed]
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        const videoObj = arr[0];
        if (videoObj?.url) {
          videoUrl = videoObj.url.startsWith("http") ? videoObj.url : `${HF_SPACE}/gradio_api/file=${videoObj.url}`;
        } else if (videoObj?.path) {
          videoUrl = `${HF_SPACE}/gradio_api/file=${videoObj.path}`;
        } else if (videoObj?.video?.url) {
          videoUrl = videoObj.video.url;
        } else if (videoObj?.video?.path) {
          videoUrl = `${HF_SPACE}/gradio_api/file=${videoObj.video.path}`;
        }
      } catch (e) {
        console.error("Failed to parse SSE data line:", e, lastDataLine.slice(0, 200));
      }
    }

    if (!videoUrl) {
      console.error("No video URL extracted. Full SSE:", sseText.slice(0, 2000));
      return new Response(
        JSON.stringify({ error: "No video URL in response", debug: sseText.slice(0, 1000) }),
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
