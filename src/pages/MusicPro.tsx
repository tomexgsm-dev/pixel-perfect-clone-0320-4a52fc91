import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Music, Download, Play } from "lucide-react";
import { toast } from "sonner";

interface Track {
  id: string;
  prompt: string;
  audio: string;
  title?: string;
  tags?: string;
  lyrics?: string;
  duration: number;
  createdAt: number;
}

const PRESETS = [
  "emotional pop, chill, soft trap, indie, melodic — song about morning coffee",
  "progressive house, deep bass, melancholic, club banger",
  "lo-fi hip hop, vinyl crackle, jazzy piano, study vibes",
  "epic cinematic orchestral, strings, dramatic, movie trailer",
  "acoustic guitar folk, warm, polish singer-songwriter",
  "heavy metal, epic, melancholic, cinematic, melodic",
  "synthwave, retro 80s, neon, driving night",
  "tropical pop, summer, indie, world music",
];

export default function MusicPro() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Wpisz opis muzyki");
      return;
    }

    setLoading(true);
    try {
      const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/music-pro`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt, duration }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const newTrack: Track = {
        id: crypto.randomUUID(),
        prompt,
        audio: data.audio,
        title: data.title,
        tags: data.tags,
        lyrics: data.lyrics,
        duration: data.duration ?? duration,
        createdAt: Date.now(),
      };

      setTracks((prev) => [newTrack, ...prev]);
      toast.success(`Utwór "${data.title || "gotowy"}" wygenerowany!`);
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Nie udało się wygenerować muzyki"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (track: Track) => {
    const a = document.createElement("a");
    a.href = track.audio;
    a.download = `${(track.title || "muzykapro").replace(/[^a-z0-9]/gi, "_")}.wav`;
    a.click();
  };

  const QUICK_DURATIONS = [30, 60, 90, 120];

  return (
    <Layout>
      <div className="flex flex-col h-full absolute inset-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full px-4 md:px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500/30 to-purple-600/30 border border-pink-500/40 flex items-center justify-center text-2xl">
                🎵
              </div>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  MuzykaPro
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                    BETA
                  </span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  Generator muzyki AI z wokalem (ACE-Step) — do 2 minut
                </p>
              </div>
            </div>
          </div>

          {/* Generator */}
          <Card className="p-5 mb-6 bg-gradient-to-br from-pink-500/5 to-purple-500/5 border-pink-500/20">
            <label className="text-sm font-medium mb-2 block">
              Opisz utwór (gatunek, nastrój, instrumenty, temat)
            </label>
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="np. emotional pop, chill, melodic — song about summer love"
              className="mb-3"
              disabled={loading}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
            />

            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-muted-foreground">
                  Długość: <span className="font-semibold text-foreground">{duration}s</span>
                  {duration >= 60 && (
                    <span className="ml-1 text-xs">({Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")})</span>
                  )}
                </label>
                <div className="flex gap-1">
                  {QUICK_DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      disabled={loading}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        duration === d
                          ? "bg-pink-500/20 border-pink-500/50 text-foreground"
                          : "border-border text-muted-foreground hover:border-pink-500/30"
                      }`}
                    >
                      {d >= 60 ? `${d / 60}min` : `${d}s`}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="range"
                min={10}
                max={120}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full accent-pink-500"
                disabled={loading}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Komponuję utwór... (60-120s, bądź cierpliwy 🎶)
                </>
              ) : (
                <>
                  <Music className="w-4 h-4" />
                  Generuj utwór
                </>
              )}
            </Button>
          </Card>

          {/* Presety */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
              💡 Szybkie pomysły
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPrompt(p)}
                  disabled={loading}
                  className="text-left text-xs p-3 rounded-lg border border-border bg-card hover:border-pink-500/40 hover:bg-pink-500/5 transition-colors disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Wygenerowane utwory */}
          {tracks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">
                🎧 Twoje utwory ({tracks.length})
              </h3>
              <div className="space-y-3">
                {tracks.map((track) => (
                  <Card key={track.id} className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <Play className="w-4 h-4 text-pink-500 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          {track.title && (
                            <h4 className="font-semibold text-sm text-foreground truncate">
                              {track.title}
                            </h4>
                          )}
                          {track.tags && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {track.tags}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-1">
                            "{track.prompt}" · {track.duration}s
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(track)}
                        className="shrink-0"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                    <audio controls src={track.audio} className="w-full h-10" />
                    {track.lyrics && (
                      <details className="mt-3">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          📝 Pokaż tekst
                        </summary>
                        <pre className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap font-sans bg-muted/30 p-3 rounded">
                          {track.lyrics}
                        </pre>
                      </details>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {tracks.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground">
              <Music className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                Wpisz opis i wygeneruj swój pierwszy utwór
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
