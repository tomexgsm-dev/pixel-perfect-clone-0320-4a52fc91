import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

export const config = {
  verify_jwt: false,
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/* ---------------- CACHE ---------------- */

const cache = new Map<string, string>();

function cacheSet(prompt: string, image: string) {
  if (cache.size > 50) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }

  cache.set(prompt, image);
}

/* ---------------- IMAGE NORMALIZER ---------------- */

function normalizeImage(img: any): string | null {
  if (!img) return null;

  if (typeof img === "string") return img;

  if (Array.isArray(img)) return img[0];

  if (img?.url) return img.url;

  return null;
}

/* ---------------- PRIMARY GENERATOR ---------------- */

async function callPrimary(prompt: string): Promise<string | null> {
  const API = Deno.env.get("NEXUS_IMAGE_API");

  if (!API) return null;

  try {
    const res = await fetch(`${API}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) return null;

    const blob = await res.blob();

    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let binary = "";

    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return `data:image/png;base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

/* ---------------- HF SERVERS ---------------- */

let AI_SERVERS = [
  { url: "https://tongyi-mai-z-image-turbo.hf.space", status: "ok" },
  { url: "https://mrfakename-z-image-turbo.hf.space", status: "ok" },
  { url: "https://ap123-illusiondiffusion.hf.space", status: "ok" },
];

function getServer() {
  const working = AI_SERVERS.filter((s) => s.status === "ok");

  if (!working.length) {
    AI_SERVERS = AI_SERVERS.map((s) => ({ ...s, status: "ok" }));
    return AI_SERVERS[0];
  }

  return working[Math.floor(Math.random() * working.length)];
}

function markDown(url: string) {
  AI_SERVERS = AI_SERVERS.map((s) =>
    s.url === url ? { ...s, status: "down" } : s,
  );
}

/* ---------------- HF CALL ---------------- */

async function callHF(prompt: string): Promise<string | null> {
  for (let i = 0; i < AI_SERVERS.length; i++) {
    const server = getServer();

    try {
      const res = await fetch(`${server.url}/run/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: [prompt, 768, "1:1", null, 15, 3],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        markDown(server.url);
        continue;
      }

      const json = await res.json();

      const img = normalizeImage(json?.data);

      if (img) return img;

      markDown(server.url);
    } catch {
      markDown(server.url);
    }
  }

  return null;
}

/* ---------------- LOVABLE ---------------- */

async function callLovable(prompt: string) {
  const KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!KEY) {
    console.error("LOVABLE_API_KEY not set");
    return null;
  }

  try {
    console.log("Calling Lovable AI for image generation...");
    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image-preview",
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Lovable AI error:", res.status, errText);
      return null;
    }

    const data = await res.json();
    const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (imageUrl) {
      console.log("Lovable AI image generated successfully");
      return imageUrl;
    }

    console.error("Lovable AI: no image in response");
    return null;
  } catch (e) {
    console.error("Lovable AI exception:", e);
    return null;
  }
}

/* ---------------- REPLICATE ---------------- */

async function callReplicate(prompt: string) {
  const API = Deno.env.get("REPLICATE_API");

  if (!API) return null;

  try {
    const create = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            prompt,
            num_outputs: 1,
            go_fast: true,
          },
        }),
      },
    );

    const prediction = await create.json();

    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const poll = await fetch(prediction.urls.get, {
        headers: {
          Authorization: `Bearer ${API}`,
        },
      });

      const data = await poll.json();

      if (data.status === "succeeded") {
        return normalizeImage(data.output);
      }

      if (data.status === "failed") break;
    }

    return null;
  } catch {
    return null;
  }
}

/* ---------------- HF INFERENCE API (free tier) ---------------- */

async function callHFInference(prompt: string): Promise<string | null> {
  const KEY = Deno.env.get("HF_KEY");
  if (!KEY) {
    console.error("HF_KEY not set");
    return null;
  }

  const models = [
    "strangerzonehf/Flux-Midjourney-Mix2-LoRA",
    "Shakker-Labs/FLUX.1-dev-LoRA-add-details",
    "CompVis/stable-diffusion-v1-4",
  ];

  for (const model of models) {
    try {
      console.log(`Trying HF Inference: ${model}`);
      const res = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: prompt }),
          signal: AbortSignal.timeout(30000),
        },
      );

      if (!res.ok) {
        console.error(`HF Inference ${model}: ${res.status}`);
        continue;
      }

      const blob = await res.blob();
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      console.log(`HF Inference ${model}: success`);
      return `data:image/png;base64,${btoa(binary)}`;
    } catch (e) {
      console.error(`HF Inference ${model} error:`, e);
    }
  }

  return null;
}

/* ---------------- GEMINI DIRECT ---------------- */

async function callGeminiDirect(prompt: string): Promise<string | null> {
  const KEY = Deno.env.get("GEMINI_KEY");
  if (!KEY) {
    console.error("GEMINI_KEY not set");
    return null;
  }

  try {
    console.log("Trying Gemini direct API...");
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
        signal: AbortSignal.timeout(30000),
      },
    );

    if (!res.ok) {
      console.error("Gemini direct error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        console.log("Gemini direct: image generated");
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    console.error("Gemini direct: no image in response");
    return null;
  } catch (e) {
    console.error("Gemini direct exception:", e);
    return null;
  }
}


function buildPrompt(
  action: string,
  prompt: string,
  image?: string,
  image2?: string,
) {
  switch (action) {
    case "product":
      if (image && image2)
        return `product from first image placed naturally inside second image background, commercial photography, ultra realistic`;

      return `professional product photography ${prompt}, studio lighting, high detail`;

    case "logo":
      return `modern logo design ${prompt}, minimal vector, white background`;

    case "banner":
      return `website banner ${prompt}, cinematic lighting, ultra wide`;

    case "social":
      return `instagram marketing post ${prompt}, modern marketing style`;

    case "restore":
      return `restore damaged photo, high quality`;

    case "upscale":
      return `ultra high resolution version of image`;

    case "colorize":
      return `colorized version of black and white photo`;

    default:
      return prompt;
  }
}

/* ---------------- GENERATOR ---------------- */

async function generateImage(prompt: string) {
  if (cache.has(prompt)) return cache.get(prompt)!;

  console.log("1) Trying primary generator...");
  const primary = await callPrimary(prompt);
  if (primary) { cacheSet(prompt, primary); return primary; }

  console.log("2) Trying Gemini direct API...");
  const gemini = await callGeminiDirect(prompt);
  if (gemini) { cacheSet(prompt, gemini); return gemini; }

  console.log("3) Trying Lovable AI...");
  const lovable = await callLovable(prompt);
  if (lovable) return lovable;

  console.log("4) Trying HF Inference API...");
  const hfInf = await callHFInference(prompt);
  if (hfInf) { cacheSet(prompt, hfInf); return hfInf; }

  console.log("5) Trying HF Spaces...");
  const hf = await callHF(prompt);
  if (hf) { cacheSet(prompt, hf); return hf; }

  console.log("6) Trying Replicate...");
  const rep = await callReplicate(prompt);
  if (rep) return rep;

  console.error("All generators failed!");
  throw new HttpError(503, "All AI generators offline");
}

/* ---------------- MAIN ---------------- */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response("OK", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const action = body?.action;
    const prompt = body?.prompt || "";
    const image = body?.image;
    const image2 = body?.image2;

    const finalPrompt = buildPrompt(action, prompt, image, image2);

    if (!finalPrompt) {
      throw new HttpError(400, "Prompt required");
    }

    const result = await generateImage(finalPrompt);

    return new Response(JSON.stringify({ image: result }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;

    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
