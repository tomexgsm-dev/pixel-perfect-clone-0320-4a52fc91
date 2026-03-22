import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let AI_SERVERS = [
  { url: "https://tongyi-mai-z-image-turbo.hf.space", status: "ok" },
  { url: "https://mrfakename-z-image-turbo.hf.space", status: "ok" },
  { url: "https://ap123-illusiondiffusion.hf.space", status: "ok" },
];

const cache: Record<string, string> = {};

function getWorkingServer() {
  const working = AI_SERVERS.filter((server) => server.status === "ok");

  if (working.length === 0) {
    AI_SERVERS = AI_SERVERS.map((server) => ({ ...server, status: "ok" }));
    return AI_SERVERS[0];
  }

  return working[Math.floor(Math.random() * working.length)];
}

function markAsDown(url: string) {
  AI_SERVERS = AI_SERVERS.map((server) =>
    server.url === url ? { ...server, status: "down" } : server,
  );
}

async function callLovableImage(prompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new HttpError(500, "LOVABLE_API_KEY is not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new HttpError(429, "Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new HttpError(402, "Credits exhausted. Please add funds.");
    }

    const errorText = await response.text();
    console.error("Lovable AI image error:", response.status, errorText);
    throw new HttpError(500, "Image generation failed");
  }

  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!imageUrl) {
    console.error("Lovable AI image response missing image:", data);
    throw new HttpError(500, "No image generated");
  }

  return imageUrl;
}

async function callPollinations(prompt: string): Promise<string> {
  const seed = Math.floor(Math.random() * 999999);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&seed=${seed}&nologo=true&model=flux`;
  console.log("🌸 Pollinations.ai request:", url);
  
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(90000), redirect: "follow" });
    if (res.ok) {
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const buffer = await res.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      return `data:${contentType};base64,${base64}`;
    }
    console.log(`⚠️ Pollinations server-side HTTP ${res.status}, returning direct URL`);
  } catch (err) {
    console.log("⚠️ Pollinations server-side fetch failed:", err);
  }
  
  // Return direct URL as last resort - browser will load it directly
  return url;
}

async function generateWithFallback(prompt: string): Promise<string> {
  if (cache[prompt]) {
    console.log("💾 Cache hit:", prompt.slice(0, 40));
    return cache[prompt];
  }

  // 1. Try HF Spaces
  for (let i = 0; i < AI_SERVERS.length; i++) {
    const server = getWorkingServer();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${server.url}/run/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          data: [prompt, 768, "1:1", null, 15, 3],
        }),
      });

      const rawText = await res.text();

      if (!res.ok) {
        console.log(`❌ HF server HTTP ${res.status}: ${server.url}`, rawText.slice(0, 200));
        markAsDown(server.url);
        continue;
      }

      let data: { data?: string[] };
      try {
        data = JSON.parse(rawText) as { data?: string[] };
      } catch (parseError) {
        console.log(`❌ HF invalid JSON: ${server.url}`, parseError, rawText.slice(0, 200));
        markAsDown(server.url);
        continue;
      }

      if (data?.data?.[0]) {
        cache[prompt] = data.data[0];
        return data.data[0];
      }

      markAsDown(server.url);
    } catch (err) {
      console.log(`❌ HF request failed: ${server.url}`, err);
      markAsDown(server.url);
    } finally {
      clearTimeout(timeout);
    }
  }

  // 2. Try Lovable AI (Gemini)
  try {
    console.log("⚠️ All HF offline, trying Lovable AI...");
    const imageUrl = await callLovableImage(prompt);
    cache[prompt] = imageUrl;
    return imageUrl;
  } catch (lovableErr) {
    console.log("⚠️ Lovable AI failed:", lovableErr);
  }

  // 3. Pollinations.ai (free, no key needed)
  console.log("🌸 Using Pollinations.ai free fallback");
  const pollinationsImage = await callPollinations(prompt);
  cache[prompt] = pollinationsImage;
  return pollinationsImage;
}

async function callLocalSD(sdUrl: string, endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  const url = `${sdUrl.replace(/\/$/, "")}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`SD API error ${res.status}: ${errorText}`);
  }

  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SD_URL = Deno.env.get("SD_LOCAL_URL");
    const hasLocalSD = typeof SD_URL === "string" && SD_URL.startsWith("http");

    const { action, prompt, image } = await req.json();
    let imageResult: string;

    switch (action) {
      case "generate": {
        if (!prompt) throw new HttpError(400, "Prompt is required");

        if (hasLocalSD) {
          try {
            const data = await callLocalSD(SD_URL, "/sdapi/v1/txt2img", {
              prompt,
              steps: 20,
              width: 512,
              height: 512,
            }) as { images: string[] };
            imageResult = `data:image/png;base64,${data.images[0]}`;
          } catch (sdErr) {
            console.log("⚠️ Local SD failed, falling back:", sdErr);
            imageResult = await generateWithFallback(prompt);
          }
        } else {
          imageResult = await generateWithFallback(prompt);
        }
        break;
      }
      case "product": {
        if (!prompt) throw new HttpError(400, "Prompt is required");

        const fullPrompt = `person holding product ${prompt}, studio lighting, realistic, advertisement, high quality`;

        if (hasLocalSD) {
          try {
            const data = await callLocalSD(SD_URL, "/sdapi/v1/txt2img", {
              prompt: fullPrompt,
              steps: 25,
              width: 512,
              height: 512,
            }) as { images: string[] };
            imageResult = `data:image/png;base64,${data.images[0]}`;
          } catch (sdErr) {
            console.log("⚠️ Local SD failed, falling back:", sdErr);
            imageResult = await generateWithFallback(fullPrompt);
          }
        } else {
          imageResult = await generateWithFallback(fullPrompt);
        }
        break;
      }
      case "upscale": {
        if (!image) throw new HttpError(400, "Image is required");
        if (!hasLocalSD) throw new HttpError(500, "Upscale wymaga lokalnego SD (ustaw SD_LOCAL_URL)");

        const data = await callLocalSD(SD_URL, "/sdapi/v1/extra-single-image", {
          image: image.startsWith("data:") ? image.split(",")[1] : image,
          upscaler_1: "R-ESRGAN 4x+",
          upscaling_resize: 4,
        }) as { image: string };
        imageResult = `data:image/png;base64,${data.image}`;
        break;
      }
      case "coloring": {
        if (!image) throw new HttpError(400, "Image is required");
        if (!hasLocalSD) throw new HttpError(500, "Kolorowanka wymaga lokalnego SD (ustaw SD_LOCAL_URL)");

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
        if (!image) throw new HttpError(400, "Image is required");
        if (!hasLocalSD) throw new HttpError(500, "Enhance wymaga lokalnego SD (ustaw SD_LOCAL_URL)");

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
        throw new HttpError(400, "Invalid action");
    }

    return new Response(JSON.stringify({ image: imageResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("image-pro error:", e);

    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Unknown error";

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});