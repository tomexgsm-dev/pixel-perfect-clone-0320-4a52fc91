import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Video,
  Mic,
  User,
  Plus,
  X,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Trash2,
  Upload,
  ImageIcon,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { cn } from "@/lib/utils";
import {
  saveVideoToGallery,
  getVideoGallery,
  deleteVideo,
} from "@/lib/api/video";

/* ------------------------------------------------
   TYPES
------------------------------------------------ */

type VideoRecord = {
  id: string;
  url: string;
  prompt: string;
  created_at: string;
};

type AvatarMode = "avatar1" | "avatar2" | "avatar3";
type VoiceMode = "voice1" | "voice2" | "voice3";

interface Scene {
  id: string;
  text: string;
}

/* ------------------------------------------------
   CONSTANTS
------------------------------------------------ */

const STATIC_PROMPTS = [
  "Professional product presentation, clean background, engaging narration, 30 seconds",
  "Corporate explainer video, modern style, clear talking points, upbeat tone",
  "Social media promo, fast cuts, energetic, trendy visual style, 15 seconds",
];

const TEMPLATES: { value: string; label: string; prompt: string }[] = [
  { value: "none", label: "No template", prompt: "" },
  { value: "ad", label: "Ad", prompt: "Create product advertisement" },
  { value: "tiktok", label: "TikTok", prompt: "Create viral TikTok video" },
  { value: "story", label: "Story", prompt: "Tell cinematic story" },
];

const AVATARS: AvatarMode[] = ["avatar1", "avatar2", "avatar3"];
const VOICES: VoiceMode[] = ["voice1", "voice2", "voice3"];

/* ------------------------------------------------
   HELPERS
------------------------------------------------ */

function mapTemplateToMode(template: string): string {
  switch (template) {
    case "tiktok":
      return "tiktok";
    case "ad":
      return "ads";
    case "story":
      // możesz zmienić na "social", jeśli wolisz
      return "cinematic";
    case "none":
    default:
      return "cinematic";
  }
}

/* ------------------------------------------------
   API — Original clever-api
------------------------------------------------ */

async function callGenerateVideo(payload: {
  prompt: string;
  avatar: AvatarMode;
  voice: VoiceMode;
  scenes: { text: string }[];
  duration: number;
  ratio: string;
  resolution: string;
  mode: string;
}): Promise<string> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/clever-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error: ${res.status}`);
  return data.video_url || data.url || "";
}

/* ------------------------------------------------
   API — Wan 2.2 I2V (Image-to-Video)
------------------------------------------------ */

async function callWanVideo(payload: {
  image: string;
  prompt: string;
  duration: number;
  fps: number;
  safe_mode: boolean;
}): Promise<string> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/wan-video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error: ${res.status}`);
  return data.video_url || "";
}

/* ------------------------------------------------
   COMPONENT
------------------------------------------------ */

export default function VideoPro() {
  const [prompt, setPrompt] = useState("");
  const [template, setTemplate] = useState("none");
  const [avatar, setAvatar] = useState<AvatarMode>("avatar1");
  const [voice, setVoice] = useState<VoiceMode>("voice1");
  const [scenes, setScenes] = useState<Scene[]>([
    { id: crypto.randomUUID(), text: "" },
  ]);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gallery, setGallery] = useState<VideoRecord[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(true);

  const [isPromptPanelOpen, setIsPromptPanelOpen] = useState(false);
  const [aiPrompts, setAiPrompts] = useState<string[]>([]);
  const [isLoadingAiPrompts, setIsLoadingAiPrompts] = useState(false);

  // Wan 2.2 I2V state
  type GenerationMode = "avatar" | "i2v";
  const [genMode, setGenMode] = useState<GenerationMode>("i2v");
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [inputImageName, setInputImageName] = useState<string>("");
  const [i2vDuration, setI2vDuration] = useState(3.5);
  const [i2vFps, setI2vFps] = useState(16);
  const [i2vSafeMode, setI2vSafeMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getVideoGallery();
        setGallery(data as VideoRecord[]);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoadingGallery(false);
      }
    })();
  }, []);

  /* scenes */
  function addScene() {
    setScenes((p) => [...p, { id: crypto.randomUUID(), text: "" }]);
  }
  function removeScene(id: string) {
    setScenes((p) => p.filter((s) => s.id !== id));
  }
  function updateScene(id: string, text: string) {
    setScenes((p) => p.map((s) => (s.id === id ? { ...s, text } : s)));
  }

  /* generate */
  async function handleGenerate() {
    if (!prompt.trim() && scenes.every((s) => !s.text.trim())) {
      setError("Wpisz prompt lub dodaj tekst sceny.");
      return;
    }

    const mode = mapTemplateToMode(template);

    try {
      setError(null);
      setIsGenerating(true);

      const url = await callGenerateVideo({
        prompt,
        avatar,
        voice,
        scenes: scenes.map((s) => ({ text: s.text })),
        duration: 10,
        ratio: "16:9",
        resolution: "1080p",
        mode,
      });

      setVideoUrl(url);

      try {
        const blob = await fetch(url).then((r) => r.blob());
        const file = new File([blob], "video.mp4", { type: blob.type });
        await saveVideoToGallery(file, { prompt, mode });
        const updated = await getVideoGallery();
        setGallery(updated as VideoRecord[]);
      } catch (e) {
        console.error("Gallery save failed", e);
      }
    } catch (e: any) {
      setError(e?.message || "Video generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  /* ai prompts */
  async function loadAiPrompts() {
    try {
      setIsLoadingAiPrompts(true);
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/prompt-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          prompt: prompt || "creative video prompts",
          type: "video",
        }),
      });
      const data = await res.json();
      const list = Array.isArray(data?.prompts)
        ? data.prompts
        : Array.isArray(data)
        ? data
        : [];
      setAiPrompts(list.slice(0, 3));
    } catch {
      setError("Failed to load AI prompts");
    } finally {
      setIsLoadingAiPrompts(false);
    }
  }

  function togglePromptPanel() {
    const next = !isPromptPanelOpen;
    setIsPromptPanelOpen(next);
    if (next && aiPrompts.length === 0) void loadAiPrompts();
  }

  function applyPrompt(p: string) {
    setPrompt(p);
    setIsPromptPanelOpen(false);
  }

  /* ------------------------------------------------ RENDER */
  return (
    <Layout>
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex flex-col min-h-full">
          <div className="max-w-5xl mx-auto w-full px-4 md:px-8 py-10">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                Nexus Video Pro{" "}
                <Sparkles className="w-5 h-5 text-primary" />
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Generate professional AI avatar videos using Nexus Video API.
                Choose your <strong>avatar</strong>, <strong>voice</strong> and
                add multiple scenes.
              </p>
            </div>

            <div className="relative flex gap-6">
              <div className="flex-1 space-y-6">
                {/* BANNER */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-border bg-gradient-to-r from-violet-950/70 via-background to-background p-[1px] shadow-glow overflow-hidden"
                >
                  <div className="relative rounded-2xl bg-card/90 px-4 py-4 md:px-6 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="pointer-events-none absolute inset-x-0 -top-1 h-[2px] overflow-hidden">
                      <motion.div
                        className="h-full w-[200%] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500"
                        animate={{ x: ["0%", "-50%"] }}
                        transition={{
                          repeat: Infinity,
                          duration: 8,
                          ease: "linear",
                        }}
                      />
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/40">
                        <Sparkles className="w-4 h-4 text-violet-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold flex items-center gap-2">
                          Nexus Video Pro
                          <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-200 border border-violet-500/40">
                            LIVE
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          AI avatars, voice selection, multi-scene scripts and
                          AI Prompt Assistant.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-xl border border-violet-500/30 bg-violet-950/40 px-3 py-2 text-violet-50">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <User className="w-3 h-3 text-violet-300" />
                          <span className="font-medium">AI Avatars</span>
                        </div>
                        <p className="text-[10px] text-violet-100/80">
                          Choose from realistic avatar styles.
                        </p>
                      </div>
                      <div className="rounded-xl border border-violet-500/30 bg-violet-950/40 px-3 py-2 text-violet-50">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Mic className="w-3 h-3 text-violet-300" />
                          <span className="font-medium">Voice + Scenes</span>
                        </div>
                        <p className="text-[10px] text-violet-100/80">
                          Pick voice and write multi-scene scripts.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* TEMPLATE */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Template
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => {
                          setTemplate(t.value);
                          if (t.prompt) setPrompt(t.prompt);
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                          template === t.value
                            ? "bg-violet-600 text-white border-violet-500 shadow-glow"
                            : "bg-card text-muted-foreground border-border hover:border-violet-500/60 hover:text-foreground"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* PROMPT */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    Prompt
                    <span className="rounded-full bg-muted px-2 py-[2px] text-[10px] text-muted-foreground border border-border">
                      Describe your video
                    </span>
                  </label>
                  <div className="relative">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-2xl border border-border bg-card/80 px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                      placeholder="Professional product presentation, engaging narration, 30 seconds..."
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={togglePromptPanel}
                      className="inline-flex items-center gap-2 rounded-full border border-violet-500/60 bg-violet-950/60 px-3 py-1.5 text-xs font-medium text-violet-100 shadow-glow hover:bg-violet-900/80 transition-colors"
                    >
                      {isPromptPanelOpen ? (
                        <PanelRightClose className="w-3.5 h-3.5" />
                      ) : (
                        <PanelRightOpen className="w-3.5 h-3.5" />
                      )}
                      AI Prompt
                    </button>
                  </div>
                </div>

                {/* AVATAR + VOICE */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                      <User className="w-3 h-3" /> Select Avatar
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {AVATARS.map((a) => (
                        <button
                          key={a}
                          onClick={() => setAvatar(a)}
                          className={cn(
                            "rounded-2xl border aspect-square flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-all",
                            avatar === a
                              ? "bg-violet-600 text-white border-violet-500 shadow-glow"
                              : "bg-card text-muted-foreground border-border hover:border-violet-500/60 hover:text-foreground"
                          )}
                        >
                          <User className="w-5 h-5" />
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                      <Mic className="w-3 h-3" /> Select Voice
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {VOICES.map((v) => (
                        <button
                          key={v}
                          onClick={() => setVoice(v)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                            voice === v
                              ? "bg-violet-600 text-white border-violet-500 shadow-glow"
                              : "bg-card text-muted-foreground border-border hover:border-violet-500/60 hover:text-foreground"
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* SCENES */}
                <div className="space-y-3">
                  <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                    <Video className="w-3 h-3" /> Scenes
                  </p>
                  <div className="space-y-2">
                    {scenes.map((scene, idx) => (
                      <div key={scene.id} className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground w-14 shrink-0">
                          Scene {idx + 1}
                        </span>
                        <input
                          value={scene.text}
                          onChange={(e) =>
                            updateScene(scene.id, e.target.value)
                          }
                          className="flex-1 rounded-2xl border border-border bg-card/80 px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                          placeholder={`Scene ${idx + 1} text...`}
                        />
                        {scenes.length > 1 && (
                          <button
                            onClick={() => removeScene(scene.id)}
                            className="p-1.5 rounded-full border border-border text-muted-foreground hover:text-destructive hover:border-destructive/60 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addScene}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-violet-300 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Scene
                  </button>
                </div>

                {/* GENERATE */}
                <div className="flex flex-wrap gap-3 items-center">
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-glow hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Generate Video
                  </button>
                  {error && (
                    <p className="text-xs text-destructive">{error}</p>
                  )}
                </div>

                {/* PREVIEW */}
                <div className="mt-4">
                  <div className="rounded-2xl border border-border bg-card/60 min-h-[260px] flex items-center justify-center overflow-hidden relative">
                    {isGenerating ? (
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
                        <p className="text-xs">Generating video…</p>
                      </div>
                    ) : videoUrl ? (
                      <motion.video
                        key={videoUrl}
                        src={videoUrl}
                        controls
                        initial={{ opacity: 0, scale: 1.02 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4 }}
                        className="max-h-[480px] w-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center px-6 py-10 text-muted-foreground text-xs gap-2">
                        <Video className="w-8 h-8 opacity-40" />
                        <p className="font-medium text-foreground">
                          No video yet
                        </p>
                        <p>Enter a prompt and click Generate Video.</p>
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/80 via-background/0 to-transparent" />
                  </div>
                  {videoUrl && (
                    <div className="mt-2 flex justify-center">
                      <a
                        href={videoUrl}
                        download
                        className="text-xs text-violet-400 hover:underline"
                      >
                        Pobierz wideo
                      </a>
                    </div>
                  )}
                </div>

                {/* GALLERY */}
                <div className="mt-8">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Video className="w-4 h-4 text-violet-400" /> Your Gallery
                  </h3>
                  {isLoadingGallery ? (
                    <p className="text-xs text-muted-foreground">
                      Loading gallery…
                    </p>
                  ) : gallery.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No videos yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {gallery.map((vid) => (
                        <div
                          key={vid.id}
                          className="relative group rounded-2xl overflow-hidden border border-border bg-card"
                        >
                          <video
                            src={vid.url}
                            className="w-full h-32 object-cover"
                          />
                          <button
                            onClick={async () => {
                              await deleteVideo(vid.id);
                              setGallery((p) =>
                                p.filter((v) => v.id !== vid.id)
                              );
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* AI PROMPT PANEL */}
              <AnimatePresence>
                {isPromptPanelOpen && (
                  <motion.aside
                    initial={{ x: 480, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 480, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 30 }}
                    className="hidden lg:flex w-[320px] xl:w-[380px] flex-col rounded-2xl border border-violet-500/40 bg-gradient-to-b from-[#050014] via-[#050014]/95 to-background/98 shadow-[0_0_40px_rgba(139,92,246,0.35)] p-4 sticky top-4 h-[calc(100vh-5rem)]"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-xl bg-violet-500/20 border border-violet-500/60 flex items-center justify-center">
                          <Sparkles className="w-3.5 h-3.5 text-violet-200" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-violet-50">
                            AI Prompt Assistant
                          </p>
                          <p className="text-[10px] text-violet-200/80">
                            Curated + AI‑generated prompts
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsPromptPanelOpen(false)}
                        className="rounded-full border border-violet-500/40 bg-violet-950/60 p-1 text-violet-100 hover:bg-violet-900/80 transition-colors"
                      >
                        <PanelRightClose className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="mb-3 rounded-xl border border-violet-500/30 bg-violet-950/40 px-3 py-2 text-[11px] text-violet-100/90">
                      <p className="font-medium mb-0.5">How it works</p>
                      <p>Click any prompt to replace your current text.</p>
                    </div>
                    <div className="space-y-3 overflow-y-auto pr-1 text-[11px]">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-violet-300/80 mb-1.5">
                          Curated prompts
                        </p>
                        <div className="space-y-1.5">
                          {STATIC_PROMPTS.map((p, idx) => (
                            <button
                              key={idx}
                              onClick={() => applyPrompt(p)}
                              className="w-full text-left rounded-xl border border-violet-500/30 bg-violet-950/40 px-3 py-2 text-violet-50 hover:bg-violet-900/70 hover:border-violet-400/70 transition-colors"
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="pt-2 border-t border-violet-500/20">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-violet-300/80">
                            AI‑generated prompts
                          </p>
                          <button
                            onClick={loadAiPrompts}
                            disabled={isLoadingAiPrompts}
                            className="inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-950/60 px-2 py-[3px] text-[10px] text-violet-100 hover:bg-violet-900/80 disabled:opacity-60"
                          >
                            {isLoadingAiPrompts ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                            Refresh
                          </button>
                        </div>
                        <div className="space-y-1.5 mt-1">
                          {aiPrompts.map((p, idx) => (
                            <button
                              key={idx}
                              onClick={() => applyPrompt(p)}
                              className="w-full text-left rounded-xl border border-violet-500/30 bg-violet-950/40 px-3 py-2 text-violet-50 hover:bg-violet-900/70 hover:border-violet-400/70 transition-colors"
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.aside>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
