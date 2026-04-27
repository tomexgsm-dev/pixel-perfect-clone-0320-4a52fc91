import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// HuggingFace Space - facebook MusicGen (darmowy generator muzyki)
const HF_SPACE_BASE = "https://facebook-musicgen.hf.space";

async function callMusicGen(prompt: string, duration: number): Promise<string> {
  // 1. POST do Gradio API → otrzymujemy event_id
  const initRes = await fetch(`${HF_SPACE_BASE}/gradio_api/call/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [prompt, null, "small", Math.min(Math.max(duration, 5), 30)],
    }),
  });

  if (!initRes.ok) {
    throw new Error(`MusicGen init failed: ${initRes.status}`);
  }

  const { event_id } = await initRes.json();
  if (!event_id) throw new Error("No event_id from MusicGen");

  // 2. GET SSE stream → szukamy 'complete'
  const streamRes = await fetch(`${HF_SPACE_BASE}/gradio_api/call/predict/${event_id}`);
  if (!streamRes.body) throw new Error("No stream body");

  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let audioUrl: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const ev of events) {
      const lines = ev.split("\n");
      const eventType = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
      const dataLine = lines.find((l) => l.startsWith("data:"))?.slice(5).trim();

      if (eventType === "complete" && dataLine) {
        try {
          const parsed = JSON.parse(dataLine);
          // MusicGen zwraca obiekt z polem 'url' lub 'path'
          const item = Array.isArray(parsed) ? parsed[0] : parsed;
          if (item?.url) audioUrl = item.url;
          else if (item?.path) audioUrl = `${HF_SPACE_BASE}/gradio_api/file=${item.path}`;
          else if (typeof item === "string") audioUrl = item;
        } catch (_) {
          // ignoruj błąd parsowania
        }
      }

      if (eventType === "error") {
        throw new Error("MusicGen returned error event");
      }
    }

    if (audioUrl) break;
  }

  if (!audioUrl) throw new Error("No audio URL returned from MusicGen");

  // 3. Pobierz plik audio i zwróć jako base64
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${audioRes.status}`);

  const arrayBuffer = await audioRes.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  return `data:audio/wav;base64,${base64}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, duration = 10 } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`MusicPro: generating music for prompt="${prompt}" duration=${duration}s`);

    const audio = await callMusicGen(prompt, Number(duration) || 10);

    console.log("MusicPro: generation successful");

    return new Response(
      JSON.stringify({ audio, prompt, duration }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("music-pro error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
