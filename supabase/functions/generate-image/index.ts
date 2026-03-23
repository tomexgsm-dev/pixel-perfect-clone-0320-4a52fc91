import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callLovable(prompt: string) {
  const KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!KEY) throw new Error("LOVABLE_API_KEY missing");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) throw new Error(`Lovable HTTP ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
}

async function callPollinations(prompt: string): Promise<string> {
  const encoded = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 999999);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&nologo=true`;

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`);

  const blob = await res.blob();
  const buffer = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return `data:image/jpeg;base64,${base64}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let imageUrl: string | undefined;
    let text = "";

    // Try Lovable first
    try {
      imageUrl = await callLovable(prompt);
      console.log("✅ Lovable image generated");
    } catch (e) {
      console.log("⚠️ Lovable failed:", e instanceof Error ? e.message : e);
    }

    // Fallback to Pollinations (free, no key needed)
    if (!imageUrl) {
      try {
        console.log("🌸 Falling back to Pollinations.ai...");
        imageUrl = await callPollinations(prompt);
        text = "Generated via Pollinations.ai fallback";
        console.log("✅ Pollinations image generated");
      } catch (e) {
        console.error("❌ Pollinations failed:", e);
      }
    }

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "All image generators unavailable" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ imageUrl, text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
