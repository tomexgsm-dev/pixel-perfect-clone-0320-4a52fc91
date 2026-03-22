import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// HuggingFace Spaces AI servers
const AI_SERVERS = [
  "https://tongyi-mai-z-image-turbo.hf.space",
  "https://mrfakename-z-image-turbo.hf.space",
  "https://ap123-illusiondiffusion.hf.space",
];

async function callLocalSD(sdUrl: string, endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  const url = `${sdUrl.replace(/\/$/, "")}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`SD API error ${res.status}: ${t}`);
  }
  return await res.json();
}

async function tryHFServers(prompt: string): Promise<string> {
  for (const server of AI_SERVERS) {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${server}/run/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [prompt, 768, "1:1", null, 15, 3],
        }),
        signal: controller.signal,
      });

      const data = await res.json() as { data?: string[] };
      if (data?.data?.[0]) {
        return data.data[0];
      }
    } catch (err) {
      console.log(`❌ HF server failed: ${server}`, err);
    }
  }
  throw new Error("All HF AI servers offline");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SD_URL = Deno.env.get("SD_LOCAL_URL");
    const hasLocalSD = SD_URL && SD_URL.startsWith("http");

    const { action, prompt, image } = await req.json();
    let imageResult: string;

    switch (action) {
      case "generate": {
        if (!prompt) throw new Error("Prompt is required");
        if (hasLocalSD) {
          const data = await callLocalSD(SD_URL, "/sdapi/v1/txt2img", {
            prompt, steps: 20, width: 512, height: 512,
          }) as { images: string[] };
          imageResult = `data:image/png;base64,${data.images[0]}`;
        } else {
          imageResult = await tryHFServers(prompt);
        }
        break;
      }
      case "product": {
        if (!prompt) throw new Error("Prompt is required");
        const fullPrompt = `person holding product ${prompt}, studio lighting, realistic, advertisement, high quality`;
        if (hasLocalSD) {
          const data = await callLocalSD(SD_URL, "/sdapi/v1/txt2img", {
            prompt: fullPrompt, steps: 25, width: 512, height: 512,
          }) as { images: string[] };
          imageResult = `data:image/png;base64,${data.images[0]}`;
        } else {
          imageResult = await tryHFServers(fullPrompt);
        }
        break;
      }
      case "upscale": {
        if (!image) throw new Error("Image is required");
        if (!hasLocalSD) throw new Error("Upscale wymaga lokalnego SD (ustaw SD_LOCAL_URL)");
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
        if (!hasLocalSD) throw new Error("Kolorowanka wymaga lokalnego SD (ustaw SD_LOCAL_URL)");
        const imgBase64 = image.startsWith("data:") ? image.split(",")[1] : image;
        const data = await callLocalSD(SD_URL, "/sdapi/v1/img2img", {
          init_images: [imgBase64],
          prompt: "clean line art coloring book page, black outlines on white background, no shading, no color",
          steps: 20, denoising_strength: 0.75, width: 512, height: 512,
        }) as { images: string[] };
        imageResult = `data:image/png;base64,${data.images[0]}`;
        break;
      }
      case "enhance": {
        if (!image) throw new Error("Image is required");
        if (!hasLocalSD) throw new Error("Enhance wymaga lokalnego SD (ustaw SD_LOCAL_URL)");
        const imgBase64 = image.startsWith("data:") ? image.split(",")[1] : image;
        const data = await callLocalSD(SD_URL, "/sdapi/v1/img2img", {
          init_images: [imgBase64],
          prompt: "high quality, sharp, detailed, HDR, enhanced colors, professional photo",
          steps: 25, denoising_strength: 0.35, width: 512, height: 512,
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
