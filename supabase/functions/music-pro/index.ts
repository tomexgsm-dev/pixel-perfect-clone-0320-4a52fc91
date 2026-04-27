import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HF_SPACE_BASE = "https://victor-ace-step-jam.hf.space";
const FALLBACK_SPACE = "https://facebook-musicgen.hf.space";
const PROCEDURAL_SAMPLE_RATE = 16_000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function encodeWavDataUrl(samples: Float32Array, sampleRate = PROCEDURAL_SAMPLE_RATE): string {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const sample of samples) {
    const s = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function callProceduralFallback(prompt: string, duration: number, tags = ""): string {
  const text = `${prompt} ${tags}`.toLowerCase();
  const seed = hashString(text || "muzykapro");
  const isMinor = /dark|sad|melanchol|metal|trap|cinematic|dramatic|mrocz|smut/i.test(text);
  const isFast = /edm|techno|house|club|dance|metal|punk|fast|szybk/i.test(text);
  const isChill = /lo-?fi|chill|ambient|study|relax|soft|spokoj/i.test(text);
  const bpm = isFast ? 132 + (seed % 18) : isChill ? 72 + (seed % 18) : 92 + (seed % 28);
  const root = 45 + (seed % 12);
  const scale = isMinor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const progression = isMinor ? [0, 5, 3, 6] : [0, 4, 5, 3];
  const totalSamples = Math.floor(duration * PROCEDURAL_SAMPLE_RATE);
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / PROCEDURAL_SAMPLE_RATE;
    const beat = (t * bpm) / 60;
    const beatPos = beat % 1;
    const beatInBar = Math.floor(beat) % 4;
    const bar = Math.floor(beat / 4);
    const chordDegree = progression[bar % progression.length];
    const bassNote = root + scale[chordDegree % scale.length] - 12;
    const chordNotes = [0, 2, 4].map((step) => root + 12 + scale[(chordDegree + step) % scale.length]);
    const arpNote = root + 24 + scale[(bar + Math.floor(beat * 2) + (seed % 5)) % scale.length];

    const bassEnv = Math.exp(-beatPos * 2.8);
    const padEnv = 0.45 + 0.25 * Math.sin(t * 0.35);
    const arpEnv = Math.exp(-((beat * 2) % 1) * 4.5);
    const bass = Math.sin(2 * Math.PI * midiToHz(bassNote) * t) * 0.28 * bassEnv;
    const pad = chordNotes.reduce((sum, note, idx) => {
      return sum + Math.sin(2 * Math.PI * midiToHz(note) * t + idx * 0.7) * 0.055 * padEnv;
    }, 0);
    const lead = Math.sin(2 * Math.PI * midiToHz(arpNote) * t) * 0.12 * arpEnv;

    const kick = beatPos < 0.16
      ? Math.sin(2 * Math.PI * (52 + 95 * Math.exp(-beatPos * 28)) * t) * Math.exp(-beatPos * 22) * 0.52
      : 0;
    const snarePos = beatInBar === 1 || beatInBar === 3 ? beatPos : 1;
    const noise = ((Math.sin((i + seed) * 12.9898) * 43758.5453) % 1) * 2 - 1;
    const snare = snarePos < 0.11 ? noise * Math.exp(-snarePos * 34) * 0.16 : 0;
    const hatPos = (beat * 2) % 1;
    const hat = hatPos < 0.035 ? noise * Math.exp(-hatPos * 90) * 0.055 : 0;
    const fade = Math.min(1, t / 1.5, (duration - t) / 2);

    samples[i] = (bass + pad + lead + kick + snare + hat) * Math.max(0, fade) * 0.72;
  }

  return encodeWavDataUrl(samples);
}

// Fallback: facebook MusicGen (instrumental, brak wokalu, ale stabilny)
async function callMusicGenFallback(prompt: string, duration: number): Promise<string> {
  const initRes = await fetch(`${FALLBACK_SPACE}/gradio_api/call/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [prompt.slice(0, 500), null, "small", Math.min(duration, 30)],
    }),
  });
  if (!initRes.ok) throw new Error(`MusicGen init ${initRes.status}`);
  const { event_id } = await initRes.json();
  if (!event_id) throw new Error("No MusicGen event_id");

  const streamRes = await fetch(`${FALLBACK_SPACE}/gradio_api/call/predict/${event_id}`);
  const reader = streamRes.body!.getReader();
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
      const eventType = ev.match(/event:\s*(\S+)/)?.[1];
      const dataLine = ev.match(/data:\s*(.+)/)?.[1];
      if (eventType === "complete" && dataLine) {
        try {
          const parsed = JSON.parse(dataLine);
          const item = Array.isArray(parsed) ? parsed[0] : parsed;
          if (item?.url) audioUrl = item.url;
          else if (item?.path) audioUrl = `${FALLBACK_SPACE}/gradio_api/file=${item.path}`;
          else if (typeof item === "string") audioUrl = item;
        } catch {}
      }
      if (eventType === "error") throw new Error("MusicGen error event");
    }
    if (audioUrl) break;
  }
  if (!audioUrl) throw new Error("MusicGen no audio");

  // Pobierz i zwróć jako base64 data URL
  const audioRes = await fetch(audioUrl);
  const buf = await audioRes.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

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

      // Step 1: retry /generate z auto-tagami i backoffem (max 2 próby)
      let recovered = false;
      const { tags, lyrics } = hasLyrics
        ? splitPromptAndLyrics(prompt)
        : { tags: "pop, melodic, emotional, vocal", lyrics: prompt.slice(0, 1500) };

      for (let attempt = 0; attempt < 2 && !recovered; attempt++) {
        try {
          const wait = (attempt + 1) * 3000;
          console.log(`MusicPro: retry /generate attempt=${attempt + 1} after ${wait}ms`);
          await sleep(wait);
          const r = await gradioCall("generate", [tags, lyrics, dur, 27, 7.0, -1, "", 0.8]);
          result = { audio: r.result.audio || r.result, tags, lyrics };
          mode = `generate-retry${attempt + 1}`;
          recovered = true;
        } catch (e) {
          console.error(`MusicPro retry ${attempt + 1} failed:`, e);
        }
      }

      // Step 2: fallback na MusicGen (krótszy, bez wokalu, ale zwykle stabilniejszy)
      if (!recovered) {
        try {
          console.log("MusicPro: falling back to MusicGen");
          const audio = await callMusicGenFallback(tags + " " + prompt.slice(0, 200), dur);
          result = { audio, tags };
          mode = "musicgen-fallback";
          recovered = true;
        } catch (e) {
          console.error("MusicGen fallback failed:", e);
        }
      }

      // Step 3: lokalny fallback proceduralny — zawsze zwraca krótki podkład WAV zamiast 503
      if (!recovered) {
        console.log("MusicPro: using procedural emergency fallback");
        const audio = callProceduralFallback(prompt, Math.min(dur, 60), tags);
        result = {
          audio,
          title: "MuzykaPro Demo Mix",
          tags: `${tags}, procedural fallback`,
        };
        mode = "procedural-fallback";
        recovered = true;
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
