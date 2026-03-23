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

/* ---------------- AI SERVERS ---------------- */

let AI_SERVERS = [
  { url: "https://tongyi-mai-z-image-turbo.hf.space", status: "ok" },
  { url: "https://mrfakename-z-image-turbo.hf.space", status: "ok" },
  { url: "https://ap123-illusiondiffusion.hf.space", status: "ok" },
];

const cache = new Map<string, string>();

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

/* ---------------- HF SPACES ---------------- */

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

      const img = json?.data?.[0];

      if (img) return img;

      markDown(server.url);
    } catch {
      markDown(server.url);
    }
  }

  return null;
}

/* ---------------- LOVABLE GEMINI ---------------- */

async function callLovable(prompt: string) {
  const KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!KEY) throw new HttpError(500, "LOVABLE_API_KEY missing");

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

  if (!res.ok) throw new Error("Lovable failed");

  const data = await res.json();

  return data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
}

/* ---------------- REPLICATE ---------------- */

async function callReplicate(prompt: string) {
  const API = Deno.env.get("REPLICATE_API");

  if (!API) throw new Error("REPLICATE_API missing");

  const create = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt,
        go_fast: true,
        num_outputs: 1,
      },
    }),
  });

  const prediction = await create.json();

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const poll = await fetch(prediction.urls.get, {
      headers: { Authorization: `Bearer ${API}` },
    });

    const data = await poll.json();

    if (data.status === "succeeded") return data.output[0];

    if (data.status === "failed") break;
  }

  throw new Error("Replicate timeout");
}

/* ---------------- POLLINATIONS (FREE) ---------------- */

async function callPollinations(prompt: string): Promise<string> {
  const seed = Math.floor(Math.random() * 999999);
  const imgUrl = `https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&nologo=true`;
  const res = await fetch(imgUrl, { signal: AbortSignal.timeout(60000), redirect: "follow" });
  if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`);

  const blob = await res.blob();
  const buffer = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return `data:image/jpeg;base64,${base64}`;
}

/* ---------------- FALLBACK ---------------- */

async function generateImage(prompt: string) {
  if (cache.has(prompt)) return cache.get(prompt)!;

  const hf = await callHF(prompt);
  if (hf) { cache.set(prompt, hf); return hf; }

  try {
    const lovable = await callLovable(prompt);
    if (lovable) return lovable;
  } catch (e) { console.log("⚠️ Lovable AI failed:", e); }

  try {
    const rep = await callReplicate(prompt);
    if (rep) return rep;
  } catch (e) { console.log("❌ Replicate failed:", e); }

  try {
    console.log("🌸 Falling back to Pollinations.ai...");
    const poll = await callPollinations(prompt);
    if (poll) return poll;
  } catch (e) { console.log("❌ Pollinations failed:", e); }

  throw new HttpError(503, "All AI generators offline");
}

/* ---------------- MAIN ---------------- */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, prompt, image } = await req.json();

    let result: string;

    switch (action) {
      case "generate":
        if (!prompt) throw new HttpError(400, "Prompt required");
        result = await generateImage(prompt);
        break;

      case "product":
        if (!prompt) throw new HttpError(400, "Prompt required");

        result = await generateImage(`professional product advertisement photo ${prompt}, studio lighting`);
        break;

      default:
        throw new HttpError(400, "Invalid action");
    }

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
