import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STABLE_DIFFUSION_VERSION = "db21e45d3b7d6765c6015396fe55718f15cc0cfe654bfcbe05e3b80ab3c5764b";
const REAL_ESRGAN_VERSION = "42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b";

async function waitForResult(url: string, apiKey: string): Promise<any> {
  for (let i = 0; i < 60; i++) {
    const res = await fetch(url, {
      headers: { Authorization: `Token ${apiKey}` },
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
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ version, input }),
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Replicate API error: ${response.status} ${t}`);
  }
  return response.json();
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
        const data = await createPrediction(REPLICATE_API, STABLE_DIFFUSION_VERSION, { prompt });
        output = await waitForResult(data.urls.get, REPLICATE_API);
        break;
      }

      case "product": {
        if (!prompt) throw new Error("Prompt is required");
        const fullPrompt = `Realistic photo: person holding product ${prompt}. Marketing style, high quality, studio light, advertisement.`;
        const data = await createPrediction(REPLICATE_API, STABLE_DIFFUSION_VERSION, { prompt: fullPrompt });
        output = await waitForResult(data.urls.get, REPLICATE_API);
        break;
      }

      case "upscale": {
        if (!image) throw new Error("Image URL is required");
        const data = await createPrediction(REPLICATE_API, REAL_ESRGAN_VERSION, { image });
        output = await waitForResult(data.urls.get, REPLICATE_API);
        break;
      }

      case "coloring": {
        if (!image) throw new Error("Image URL is required");
        const colorPrompt = "Convert to clean line art coloring book page, black outlines on white background, no shading";
        const data = await createPrediction(REPLICATE_API, STABLE_DIFFUSION_VERSION, {
          prompt: colorPrompt,
          image,
        });
        output = await waitForResult(data.urls.get, REPLICATE_API);
        break;
      }

      case "enhance": {
        if (!image) throw new Error("Image URL is required");
        const enhancePrompt = "Enhance photo quality, increase sharpness, improve colors, HD quality, realistic";
        const data = await createPrediction(REPLICATE_API, STABLE_DIFFUSION_VERSION, {
          prompt: enhancePrompt,
          image,
        });
        output = await waitForResult(data.urls.get, REPLICATE_API);
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action. Use: generate, product, upscale, coloring, enhance" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const imageUrl = Array.isArray(output) ? output[0] : output;

    return new Response(JSON.stringify({ image: imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("image-pro error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
