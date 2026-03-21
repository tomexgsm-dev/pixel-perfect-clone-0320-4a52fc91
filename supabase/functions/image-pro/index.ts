import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// SDXL version hash
const SDXL_VERSION = "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";
const REAL_ESRGAN_VERSION = "42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b";

async function waitForResult(url: string, apiKey: string): Promise<any> {
  for (let i = 0; i < 120; i++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const result = await res.json();
    if (result.status === "succeeded") return result.output;
    if (result.status === "failed" || result.status === "canceled") {
      throw new Error(result.error || "AI processing failed");
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Timeout waiting for result");
}

async function createPrediction(apiKey: string, version: string, input: Record<string, any>) {
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({ version, input }),
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Replicate API error: ${response.status} ${t}`);
  }
  const data = await response.json();
  if (data.status === "succeeded") return data.output;
  if (data.status === "failed") throw new Error(data.error || "AI processing failed");
  if (data.urls?.get) return await waitForResult(data.urls.get, apiKey);
  return data.output;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const REPLICATE_API = Deno.env.get("REPLICATE_API");
    if (!REPLICATE_API) throw new Error("REPLICATE_API is not configured");

    const { action, prompt, image } = await req.json();
    let output: any;

    switch (action) {
      case "generate": {
        if (!prompt) throw new Error("Prompt is required");
        output = await createPrediction(REPLICATE_API, SDXL_VERSION, { prompt, width: 1024, height: 1024 });
        break;
      }
      case "product": {
        if (!prompt) throw new Error("Prompt is required");
        const fullPrompt = `Realistic photo: person holding product ${prompt}. Marketing style, high quality, studio light, advertisement.`;
        output = await createPrediction(REPLICATE_API, SDXL_VERSION, { prompt: fullPrompt, width: 1024, height: 1024 });
        break;
      }
      case "upscale": {
        if (!image) throw new Error("Image URL is required");
        output = await createPrediction(REPLICATE_API, REAL_ESRGAN_VERSION, { image, scale: 4 });
        break;
      }
      case "coloring": {
        if (!image) throw new Error("Image URL is required");
        output = await createPrediction(REPLICATE_API, SDXL_VERSION, {
          prompt: "Convert to clean line art coloring book page, black outlines on white background, no shading",
          image,
        });
        break;
      }
      case "enhance": {
        if (!image) throw new Error("Image URL is required");
        output = await createPrediction(REPLICATE_API, SDXL_VERSION, {
          prompt: "Enhance photo quality, increase sharpness, improve colors, HD quality, realistic",
          image,
        });
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const imageUrl = Array.isArray(output) ? output[0] : output;
    return new Response(JSON.stringify({ image: imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("image-pro error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
