import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// HuggingFace Space - ACE-Step Jam (do 2 min, wysoka jakość, z wokalem)
const HF_SPACE_BASE = "https://victor-ace-step-jam.hf.space";

async function callAceStep(
  description: string,
  duration: number
): Promise<{ audio: string; title?: string; tags?: string; lyrics?: string }> {
  // 1. POST → event_id
  const initRes = await fetch(`${HF_SPACE_BASE}/gradio_api/call/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [description, duration, -1, false], // description, audio_duration, seed, community
    }),
  });

  if (!initRes.ok) {
    const t = await initRes.text();
    throw new Error(`ACE-Step init failed [${initRes.status}]: ${t.slice(0, 200)}`);
  }

  const initJson = await initRes.json();
  const event_id = initJson?.event_id;
  if (!event_id) throw new Error("No event_id from ACE-Step");

  // 2. GET SSE stream
  const streamRes = await fetch(`${HF_SPACE_BASE}/gradio_api/call/create/${event_id}`);
  if (!streamRes.body) throw new Error("No stream body");

  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: any = null;
  let debug = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const ev of events) {
      debug += ev + "\n\n";
      const lines = ev.split("\n");
      const eventType = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
      const dataLine = lines.find((l) => l.startsWith("data:"))?.slice(5).trim();

      if (eventType === "complete" && dataLine) {
        try {
          const parsed = JSON.parse(dataLine);
          // /create zwraca JSON-string w pierwszym elemencie tablicy
          const item = Array.isArray(parsed) ? parsed[0] : parsed;
          if (typeof item === "string") {
            try {
              result = JSON.parse(item);
            } catch {
              result = { audio: item };
            }
          } else {
            result = item;
          }
        } catch (e) {
          console.error("Parse error:", e);
        }
      }

      if (eventType === "error") {
        throw new Error(`ACE-Step error event: ${debug.slice(-500)}`);
      }
    }

    if (result) break;
  }

  if (!result?.audio) {
    throw new Error(`No audio in result. Debug: ${debug.slice(-500)}`);
  }

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, duration = 60 } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit: 10s - 120s (2 min max - limit ACE-Step Jam)
    const dur = Math.min(Math.max(Number(duration) || 60, 10), 120);

    console.log(`MusicPro: ACE-Step generating prompt="${prompt}" duration=${dur}s`);

    const result = await callAceStep(prompt, dur);

    console.log(`MusicPro: success - title="${result.title}" audio length=${result.audio?.length}`);

    return new Response(
      JSON.stringify({
        audio: result.audio,
        title: result.title,
        tags: result.tags,
        lyrics: result.lyrics,
        duration: dur,
      }),
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
