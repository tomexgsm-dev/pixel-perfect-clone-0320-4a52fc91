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
  createdAt: number;
}

const PRESETS = [
  "Energetic electronic dance track with synth leads, 128 BPM",
  "Lo-fi hip hop beat with vinyl crackle, jazzy piano, mellow",
  "Epic cinematic orchestral with strings and dramatic drums",
  "Acoustic guitar folk melody, warm and uplifting",
  "Dark ambient soundscape with deep pads and reverb",
  "Funky bassline with brass section, groovy disco vibe",
];

export default function MusicPro() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(10);
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
        createdAt: Date.now(),
      };

      setTracks((prev) => [newTrack, ...prev]);
      toast.success("Muzyka wygenerowana!");
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
    a.download = `muzykapro-${track.id.slice(0, 8)}.wav`;
    a.click();
  };

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
                  Generator muzyki AI — opisz co chcesz usłyszeć
                </p>
              </div>
            </div>
          </div>

          {/* Generator */}
          <Card className="p-5 mb-6 bg-gradient-to-br from-pink-500/5 to-purple-500/5 border-pink-500/20">
            <label className="text-sm font-medium mb-2 block">
              Opisz muzykę (po angielsku zwykle daje lepsze efekty)
            </label>
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="np. Energetic electronic dance track with synth leads, 128 BPM"
              className="mb-3"
              disabled={loading}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
            />

            <div className="flex items-center gap-3 mb-3">
              <label className="text-sm text-muted-foreground">
                Długość: <span className="font-semibold text-foreground">{duration}s</span>
              </label>
              <input
                type="range"
                min={5}
                max={30}
                step={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="flex-1 accent-pink-500"
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
                  Generuję muzykę... (może potrwać 30-60s)
                </>
              ) : (
                <>
                  <Music className="w-4 h-4" />
                  Generuj muzykę
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
                        <p className="text-sm text-foreground line-clamp-2">
                          {track.prompt}
                        </p>
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
                    <audio
                      controls
                      src={track.audio}
                      className="w-full h-10"
                    />
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
