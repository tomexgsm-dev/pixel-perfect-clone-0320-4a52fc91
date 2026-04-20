import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HF_SPACE = "https://webnowa-wan2-2-fp8da-aoti-preview2.hf.space";
const ALLOWED_FPS = [16, 32, 64, 128];

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

    const HF_KEY = Deno.env.get("HF_KEY");
    const authHeaders: Record<string, string> = HF_KEY
      ? { Authorization: `Bearer ${HF_KEY}` }
      : {};

    // If image is a data URI, upload it to Gradio first to get a server-side path.
    // Gradio rejects large base64 payloads passed inline as `url`.
    let imageData: Record<string, unknown>;
    if (typeof image === "string" && image.startsWith("data:")) {
      const match = image.match(/^data:(.+?);base64,(.*)$/);
      if (!match) {
        return new Response(
          JSON.stringify({ error: "Invalid data URI format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const mime = match[1];
      const b64 = match[2];
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
      const filename = `input_${Date.now()}.${ext}`;
      const blob = new Blob([bin], { type: mime });

      const form = new FormData();
      form.append("files", blob, filename);

      console.log(`Uploading image to Gradio (${(bin.length / 1024).toFixed(1)} KB, ${mime})...`);
      const upRes = await fetch(`${HF_SPACE}/gradio_api/upload`, {
        method: "POST",
        headers: authHeaders,
        body: form,
        signal: AbortSignal.timeout(60000),
      });

      if (!upRes.ok) {
        const t = await upRes.text();
        console.error("Gradio upload failed:", upRes.status, t.slice(0, 300));
        return new Response(
          JSON.stringify({ error: `Image upload failed: ${upRes.status}`, details: t.slice(0, 300) }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const uploaded = await upRes.json();
      const serverPath = Array.isArray(uploaded) ? uploaded[0] : uploaded;
      console.log("Uploaded to Gradio path:", serverPath);

      imageData = {
        path: serverPath,
        url: `${HF_SPACE}/gradio_api/file=${serverPath}`,
        orig_name: filename,
        size: bin.length,
        mime_type: mime,
        meta: { _type: "gradio.FileData" },
      };
    } else {
      // Already a public URL
      imageData = {
        path: null,
        url: image,
        meta: { _type: "gradio.FileData" },
      };
    }

    // Snap fps to allowed enum values [16, 32, 64, 128]
    const requestedFps = typeof fps === "number" ? fps : 16;
    const frameMultiplier = ALLOWED_FPS.reduce((prev, curr) =>
      Math.abs(curr - requestedFps) < Math.abs(prev - requestedFps) ? curr : prev
    );

    // Gradio /call API expects parameters as a positional array (data)
    const payload = {
      data: [
        imageData,                                                                      // 0  input_image
        null,                                                                           // 1  last_image (optional)
        prompt || "make this image come alive, cinematic motion, smooth animation",     // 2  prompt
        6,                                                                              // 3  steps
        "blurry, low quality, distorted, ugly, deformed",                               // 4  negative_prompt
        typeof duration === "number" ? Math.min(Math.max(duration, 0.5), 10) : 3.5,     // 5  duration_seconds
        1,                                                                              // 6  guidance_scale
        1,                                                                              // 7  guidance_scale_2
        42,                                                                             // 8  seed
        true,                                                                           // 9  randomize_seed
        6,                                                                              // 10 quality
        "UniPCMultistep",                                                               // 11 scheduler
        3.0,                                                                            // 12 flow_shift
        frameMultiplier,                                                                // 13 frame_multiplier (must be number from enum)
        safe_mode ?? false,                                                             // 14 safe_mode
        true,                                                                           // 15 video_component
      ],
    };

    console.log("Calling Wan 2.2 I2V — submit job...");

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
      signal: AbortSignal.timeout(300000),
    });

    if (!resultRes.ok) {
      const errText = await resultRes.text();
      console.error("Wan SSE error:", resultRes.status, errText.slice(0, 500));
      return new Response(
        JSON.stringify({ error: `Video generation failed: ${resultRes.status}`, details: errText.slice(0, 500) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sseText = await resultRes.text();
    console.log("SSE response (first 300 chars):", sseText.slice(0, 300));

    // Parse SSE: find event: complete, then read its data line
    let videoUrl: string | null = null;
    let completeData = "";
    const lines = sseText.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("event: complete") || lines[i].startsWith("event:complete")) {
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].startsWith("data:")) {
            completeData = lines[j].slice(5).trim();
            break;
          }
        }
        break;
      }
    }

    // Detect error event from Gradio SSE
    if (!completeData) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("event: error") || lines[i].startsWith("event:error")) {
          console.error("Gradio returned error event. Full SSE:", sseText.slice(0, 1500));
          return new Response(
            JSON.stringify({
              error: "Wan 2.2 odrzucił żądanie. Możliwe przyczyny: obraz za duży lub z metadanymi C2PA/watermark, kolejka GPU przeciążona, lub limit ZeroGPU. Spróbuj ponownie za chwilę z innym obrazem.",
              debug: sseText.slice(0, 800),
            }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    if (completeData) {
      try {
        const parsed = JSON.parse(completeData);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        const videoObj = arr[0];
        if (videoObj?.url) {
          videoUrl = videoObj.url.startsWith("http")
            ? videoObj.url
            : `${HF_SPACE}/gradio_api/file=${videoObj.url}`;
        } else if (videoObj?.path) {
          videoUrl = `${HF_SPACE}/gradio_api/file=${videoObj.path}`;
        }
      } catch (e) {
        console.error("Failed to parse SSE complete data:", e, completeData.slice(0, 200));
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
