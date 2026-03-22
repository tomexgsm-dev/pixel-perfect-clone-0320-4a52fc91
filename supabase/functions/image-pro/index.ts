import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// 🔥 Multi-AI: Lovable AI models (no API key needed from user)
const AI_MODELS = [
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-3-pro-image-preview",
];

async function tryLovableAI(prompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  for (const model of AI_MODELS) {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 30000);

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        console.log(`❌ Model ${model} returned ${res.status}`);
        continue;
      }

      const data = await res.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (imageUrl) {
        console.log(`✅ AI OK: ${model}`);
        return imageUrl;
      }

      console.log(`❌ Model ${model}: no image in response`);
    } catch (err) {
      console.log(`❌ Model ${model} error:`, err);
    }
  }

  throw new Error("All AI models failed");
}

// --- Fallback: local SD API ---
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

function getValidSdUrl(): string | null {
  const raw = Deno.env.get("SD_LOCAL_URL");
  return raw && raw.startsWith("http") ? raw : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, prompt, image } = await req.json();
    const SD_URL = getValidSdUrl();

    let imageResult: string;

    switch (action) {
      case "generate": {
        if (!prompt) throw new Error("Prompt is required");
        try {
          imageResult = await tryLovableAI(prompt);
        } catch (aiErr) {
          console.log("Lovable AI failed, trying local SD...", aiErr);
          if (!SD_URL) throw new Error("All AI offline");
          const data = await callLocalSD(SD_URL, "/sdapi/v1/txt2img", {
            prompt, steps: 20, width: 512, height: 512,
          }) as { images: string[] };
          imageResult = `data:image/png;base64,${data.images[0]}`;
        }
        break;
      }
      case "product": {
        if (!prompt) throw new Error("Prompt is required");
        const fullPrompt = `person holding product ${prompt}, studio lighting, realistic, advertisement, high quality`;
        try {
          imageResult = await tryLovableAI(fullPrompt);
        } catch {
          if (!SD_URL) throw new Error("All AI offline");
          const data = await callLocalSD(SD_URL, "/sdapi/v1/txt2img", {
            prompt: fullPrompt, steps: 25, width: 512, height: 512,
          }) as { images: string[] };
          imageResult = `data:image/png;base64,${data.images[0]}`;
        }
        break;
      }
      case "upscale": {
        if (!image) throw new Error("Image is required");
        if (SD_URL) {
          const data = await callLocalSD(SD_URL, "/sdapi/v1/extra-single-image", {
            image: image.startsWith("data:") ? image.split(",")[1] : image,
            upscaler_1: "R-ESRGAN 4x+",
            upscaling_resize: 4,
          }) as { image: string };
          imageResult = `data:image/png;base64,${data.image}`;
        } else {
          // Fallback: ask AI to upscale/enhance
          imageResult = await tryLovableAI(`Upscale and enhance this image to higher resolution with sharper details. Image URL: ${image}`);
        }
        break;
      }
      case "coloring": {
        if (!image) throw new Error("Image is required");
        if (SD_URL) {
          const imgBase64 = image.startsWith("data:") ? image.split(",")[1] : image;
          const data = await callLocalSD(SD_URL, "/sdapi/v1/img2img", {
            init_images: [imgBase64],
            prompt: "clean line art coloring book page, black outlines on white background, no shading, no color",
            steps: 20, denoising_strength: 0.75, width: 512, height: 512,
          }) as { images: string[] };
          imageResult = `data:image/png;base64,${data.images[0]}`;
        } else {
          imageResult = await tryLovableAI(`Convert this image into a clean line art coloring book page with black outlines on white background, no shading, no color. Image URL: ${image}`);
        }
        break;
      }
      case "enhance": {
        if (!image) throw new Error("Image is required");
        if (SD_URL) {
          const imgBase64 = image.startsWith("data:") ? image.split(",")[1] : image;
          const data = await callLocalSD(SD_URL, "/sdapi/v1/img2img", {
            init_images: [imgBase64],
            prompt: "high quality, sharp, detailed, HDR, enhanced colors, professional photo",
            steps: 25, denoising_strength: 0.35, width: 512, height: 512,
          }) as { images: string[] };
          imageResult = `data:image/png;base64,${data.images[0]}`;
        } else {
          imageResult = await tryLovableAI(`Enhance this image: make it high quality, sharp, detailed, HDR, with enhanced colors like a professional photo. Image URL: ${image}`);
        }
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
