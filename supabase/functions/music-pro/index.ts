import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HF_SPACE_BASE = "https://victor-ace-step-jam.hf.space";

// Detekcja czy prompt zawiera lyrics
function looksLikeLyrics(text: string): boolean {
  return (
    text.length > 200 ||
    /\[(zwrotka|verse|refren|chorus|bridge|outro|intro|hook)/i.test(text)
  );
}

// Rozdzielenie prompta na (tags, lyrics)
function splitPromptAndLyrics(text: string): { tags: string; lyrics: string } {
  // Szukaj linii z tagami (krótka, zawiera przecinki, bpm, gatunki)
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Heurystyka: linia z gatunkami zwykle krótka, zawiera słowa typu pop/rap/trap/bpm itd.
  const tagKeywords = /\b(pop|rap|trap|rock|metal|jazz|house|techno|edm|hip[- ]?hop|lofi|lo-fi|ambient|cinematic|orchestral|acoustic|folk|funk|disco|synthwave|country|reggae|punk|indie|electronic|bpm|vocal|male|female|aggressive|chill|dark|melodic|emotional)\b/i;

  let tagsLine = "";
  const lyricsLines: string[] = [];

  for (const line of lines) {
    if (
      !tagsLine &&
      line.length < 200 &&
      tagKeywords.test(line) &&
      !/^\[/.test(line)
    ) {
      // pierwsza linia wyglądająca na tagi
      tagsLine = line.replace(/^🔥?\s*styl[^:]*:?/i, "").trim();
    } else {
      lyricsLines.push(line);
    }
  }

  // Jeśli nie znaleziono tagów - użyj domyślnych
  if (!tagsLine) {
    tagsLine = "pop, melodic, emotional";
  }

  const lyrics = lyricsLines.join("\n").trim() || text;

  return { tags: tagsLine, lyrics };
}

async function gradioCall(
  endpoint: string,
  data: unknown[]
): Promise<{ result: any; debug: string }> {
  const initRes = await fetch(`${HF_SPACE_BASE}/gradio_api/call/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });

  if (!initRes.ok) {
    const t = await initRes.text();
    throw new Error(`gradio init failed [${initRes.status}]: ${t.slice(0, 200)}`);
  }

  const initJson = await initRes.json();
  const event_id = initJson?.event_id;
  if (!event_id) throw new Error("No event_id");

  const streamRes = await fetch(
    `${HF_SPACE_BASE}/gradio_api/call/${endpoint}/${event_id}`
  );
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
        throw new Error(`SPACE_ERROR:${endpoint}`);
      }
    }

    if (result) break;
  }

  if (!result) throw new Error(`No result from ${endpoint}. Debug: ${debug.slice(-300)}`);

  return { result, debug };
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

    const dur = Math.min(Math.max(Number(duration) || 60, 10), 120);
    const hasLyrics = looksLikeLyrics(prompt);

    console.log(
      `MusicPro: mode=${hasLyrics ? "generate" : "create"} dur=${dur}s len=${prompt.length}`
    );

    let result: any;
    let mode: string;

    try {
      if (hasLyrics) {
        // Endpoint /generate: prompt(tags), lyrics, duration, infer_step, guidance, seed, lora, weight
        const { tags, lyrics } = splitPromptAndLyrics(prompt);
        console.log(`MusicPro: tags="${tags.slice(0, 100)}" lyrics_len=${lyrics.length}`);
        const r = await gradioCall("generate", [tags, lyrics, dur, 27, 7.0, -1, "", 0.8]);
        result = { audio: r.result.audio || r.result, tags, lyrics };
        mode = "generate";
      } else {
        // Endpoint /create: krótki opis, LLM komponuje
        const r = await gradioCall("create", [prompt, dur, -1, false]);
        result = r.result;
        mode = "create";
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`MusicPro primary failed: ${msg}`);

      // Jeśli /create rzucił SPACE_ERROR — spróbuj /generate jako fallback
      if (msg.startsWith("SPACE_ERROR:create") || msg.includes("create")) {
        console.log("MusicPro: fallback to /generate with auto tags");
        const r = await gradioCall("generate", [
          "pop, melodic, emotional, vocal",
          prompt.slice(0, 1500),
          dur,
          27,
          7.0,
          -1,
          "",
          0.8,
        ]);
        result = { audio: r.result.audio || r.result };
        mode = "generate-fallback";
      } else {
        // Zwróć user-friendly error 200 (frontend obsługuje msg)
        return new Response(
          JSON.stringify({
            error:
              "ACE-Step Space jest przeciążony lub odrzucił żądanie (ZeroGPU queue / błąd kompozycji). Spróbuj ponownie za chwilę lub użyj krótszego opisu.",
            retry: true,
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!result?.audio) {
      return new Response(
        JSON.stringify({ error: "No audio returned by ACE-Step" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`MusicPro: success mode=${mode}`);

    return new Response(
      JSON.stringify({
        audio: result.audio,
        title: result.title,
        tags: result.tags,
        lyrics: result.lyrics,
        duration: dur,
        mode,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("music-pro fatal:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
