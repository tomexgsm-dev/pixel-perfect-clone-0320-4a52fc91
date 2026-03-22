import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// 🔥 Multi-AI: HuggingFace Spaces (Gradio API)
const AI_SERVERS = [
  { url: "https://tongyi-mai-z-image-turbo.hf.space", status: "ok" },
  { url: "https://mrfakename-z-image-turbo.hf.space", status: "ok" },
  { url: "https://ap123-illusiondiffusion.hf.space", status: "ok" },
];

// Clone state per request to avoid shared mutation issues in edge functions
function createServerPool() {
  return AI_SERVERS.map(s => ({ ...s }));
}

function getWorkingServer(pool: typeof AI_SERVERS) {
  const working = pool.filter(s => s.status === "ok");
  if (working.length === 0) {
    pool.forEach(s => s.status = "ok");
    return pool[0];
  }
  return working[Math.floor(Math.random() * working.length)];
}

function markAsDown(pool: typeof AI_SERVERS, url: string) {
  const s = pool.find(s => s.url === url);
  if (s) s.status = "down";
}

async function tryMultiAI(prompt: string): Promise<string> {
  const pool = createServerPool();

  for (let i = 0; i < pool.length; i++) {
    const server = getWorkingServer(pool);
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${server.url}/run/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [prompt, 768, "1:1", null, 15, 3],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        console.log(`❌ AI ${res.status}:`, server.url);
        markAsDown(pool, server.url);
        continue;
      }

      const data = await res.json();

      if (data?.data?.[0]) {
        console.log("✅ AI OK:", server.url);
        return data.data[0]; // base64 or URL from Gradio
      }

      markAsDown(pool, server.url);
    } catch (err) {
      console.log("❌ AI padło:", server.url, err);
      markAsDown(pool, server.url);
    }
  }

  throw new Error("Wszystkie serwery AI offline");
}

// --- Fallback: local SD API (if SD_LOCAL_URL is set) ---
async function callLocalSD(sdUrl: string, endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  const url = `${sdUrl.replace(/\/$/, "")}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`SD API error ${res.status}: ${t}`);
  }
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, prompt, image } = await req.json();
    const rawSdUrl = Deno.env.get("SD_LOCAL_URL");
    const SD_URL = rawSdUrl && rawSdUrl.startsWith("http") ? rawSdUrl : null;
    if (rawSdUrl && !SD_URL) {
      console.warn("SD_LOCAL_URL is not a valid URL (starts with:", rawSdUrl.substring(0, 10) + "...)");
    }

    let imageResult: string;

    switch (action) {
      case "generate": {
        if (!prompt) throw new Error("Prompt is required");

        // 🔥 Try multi-AI (HF Spaces) first, then fall back to local SD
        try {
          imageResult = await tryMultiAI(prompt);
        } catch (multiErr) {
          console.log("Multi-AI failed, trying local SD...", multiErr);
          if (!SD_URL) throw new Error("All AI servers offline and no local SD configured");
          const data = await callLocalSD(SD_URL, "/sdapi/v1/txt2img", {
            prompt,
            steps: 20,
            width: 512,
            height: 512,
          }) as { images: string[] };
          imageResult = `data:image/png;base64,${data.images[0]}`;
        }
        break;
      }
      case "product": {
        if (!prompt) throw new Error("Prompt is required");
        const fullPrompt = `person holding product ${prompt}, studio lighting, realistic, advertisement, high quality`;

        try {
          imageResult = await tryMultiAI(fullPrompt);
        } catch {
          if (!SD_URL) throw new Error("All AI servers offline");
          const data = await callLocalSD(SD_URL, "/sdapi/v1/txt2img", {
            prompt: fullPrompt,
            steps: 25,
            width: 512,
            height: 512,
          }) as { images: string[] };
          imageResult = `data:image/png;base64,${data.images[0]}`;
        }
        break;
      }
      case "upscale": {
        if (!image) throw new Error("Image is required");
        if (!SD_URL) throw new Error("Upscale requires local SD");
        const data = await callLocalSD(SD_URL, "/sdapi/v1/extra-single-image", {
          image: image.startsWith("data:") ? image.split(",")[1] : image,
          upscaler_1: "R-ESRGAN 4x+",
          upscaling_resize: 4,
        }) as { image: string };
        imageResult = `data:image/png;base64,${data.image}`;
        break;
      }
      case "coloring": {
        if (!image) throw new Error("Image is required");
        if (!SD_URL) throw new Error("Coloring requires local SD");
        const imgBase64 = image.startsWith("data:") ? image.split(",")[1] : image;
        const data = await callLocalSD(SD_URL, "/sdapi/v1/img2img", {
          init_images: [imgBase64],
          prompt: "clean line art coloring book page, black outlines on white background, no shading, no color",
          steps: 20,
          denoising_strength: 0.75,
          width: 512,
          height: 512,
        }) as { images: string[] };
        imageResult = `data:image/png;base64,${data.images[0]}`;
        break;
      }
      case "enhance": {
        if (!image) throw new Error("Image is required");
        if (!SD_URL) throw new Error("Enhance requires local SD");
        const imgBase64 = image.startsWith("data:") ? image.split(",")[1] : image;
        const data = await callLocalSD(SD_URL, "/sdapi/v1/img2img", {
          init_images: [imgBase64],
          prompt: "high quality, sharp, detailed, HDR, enhanced colors, professional photo",
          steps: 25,
          denoising_strength: 0.35,
          width: 512,
          height: 512,
        }) as { images: string[] };
        imageResult = `data:image/png;base64,${data.images[0]}`;
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ image: imageResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("image-pro error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
