import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
      headers: { "Content-Type": "application/json" },
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
  AI_SERVERS = AI_SERVERS.map((s) => (s.url === url ? { ...s, status: "down" } : s));
}

/* ---------------- HF CALL ---------------- */

async function callHF(prompt: string): Promise<string | null> {
  for (let i = 0; i < AI_SERVERS.length; i++) {
    const server = getServer();

    try {
      const res = await fetch(`${server.url}/run/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  if (!KEY) return null;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();

    return normalizeImage(data?.choices?.[0]?.message?.images?.[0]?.image_url?.url);
  } catch {
    return null;
  }
}

/* ---------------- REPLICATE ---------------- */

async function callReplicate(prompt: string) {
  const API = Deno.env.get("REPLICATE_API");

  if (!API) return null;

  try {
    const create = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
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
    });

    const prediction = await create.json();

    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const poll = await fetch(prediction.urls.get, {
        headers: { Authorization: `Bearer ${API}` },
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

/* ---------------- PROMPT ENGINE ---------------- */

function buildPrompt(action: string, prompt: string, image?: string, image2?: string) {
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

  const primary = await callPrimary(prompt);

  if (primary) {
    cacheSet(prompt, primary);
    return primary;
  }

  const hf = await callHF(prompt);

  if (hf) {
    cacheSet(prompt, hf);
    return hf;
  }

  const lovable = await callLovable(prompt);

  if (lovable) return lovable;

  const rep = await callReplicate(prompt);

  if (rep) return rep;

  throw new HttpError(503, "All AI generators offline");
}

/* ---------------- MAIN ---------------- */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, prompt, image, image2 } = await req.json();

    const finalPrompt = buildPrompt(action, prompt || "", image, image2);

    if (!finalPrompt) throw new HttpError(400, "Prompt required");

    const result = await generateImage(finalPrompt);

    return new Response(JSON.stringify({ image: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;

    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
