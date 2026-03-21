import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

async function runModel(apiKey: string, model: string, input: Record<string, any>) {
  const response = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({ input }),
  });

  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Replicate API error: ${response.status} ${t}`);
  }

  const data = await response.json();

  // If "Prefer: wait" returned a completed prediction
  if (data.status === "succeeded") return data.output;
  if (data.status === "failed") throw new Error(data.error || "AI processing failed");

  // Otherwise poll
  if (data.urls?.get) {
    return await waitForResult(data.urls.get, apiKey);
  }

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
        output = await runModel(REPLICATE_API, "stability-ai/sdxl", { prompt, width: 1024, height: 1024 });
        break;
      }

      case "product": {
        if (!prompt) throw new Error("Prompt is required");
        const fullPrompt = `Realistic photo: person holding product ${prompt}. Marketing style, high quality, studio light, advertisement.`;
        output = await runModel(REPLICATE_API, "stability-ai/sdxl", { prompt: fullPrompt, width: 1024, height: 1024 });
        break;
      }

      case "upscale": {
        if (!image) throw new Error("Image URL is required");
        output = await runModel(REPLICATE_API, "nightmareai/real-esrgan", { image, scale: 4 });
        break;
      }

      case "coloring": {
        if (!image) throw new Error("Image URL is required");
        const colorPrompt = "Convert to clean line art coloring book page, black outlines on white background, no shading";
        output = await runModel(REPLICATE_API, "stability-ai/sdxl", { prompt: colorPrompt, image });
        break;
      }

      case "enhance": {
        if (!image) throw new Error("Image URL is required");
        const enhancePrompt = "Enhance photo quality, increase sharpness, improve colors, HD quality, realistic";
        output = await runModel(REPLICATE_API, "stability-ai/sdxl", { prompt: enhancePrompt, image });
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
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
