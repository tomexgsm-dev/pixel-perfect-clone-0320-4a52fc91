import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useI18n } from "@/i18n";
import { useProfile } from "@/hooks/use-profile";
import { useFreeLimits } from "@/hooks/use-free-limits";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown, Loader2, Sparkles, Lock, Download, X, Shuffle, Trophy, AlertTriangle, Copy, Scissors, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Template {
  id: string;
  name: string;
  prompt: string;
  chatPrompt: string;
  pro: boolean;
  icon: string;
}

const TEMPLATES: Template[] = [
  { id: "trading-tiktok", name: "Trading viral TikTok", prompt: "futuristic trading chart, neon style, viral TikTok style, dynamic composition", chatPrompt: "Napisz krótki, viralowy opis na TikToka o tradingu – styl motywacyjny, z emoji", pro: false, icon: "📈" },
  { id: "crypto-lifestyle", name: "Crypto success lifestyle", prompt: "luxury crypto lifestyle, futuristic city, neon lights, cinematic", chatPrompt: "Napisz opis posta o sukcesie w krypto – motywujący, z hashtagami", pro: false, icon: "💎" },
  { id: "youtube-thumb", name: "Miniatura YouTube viral", prompt: "YouTube thumbnail, bold text overlay, high contrast, eye-catching, professional", chatPrompt: "Zaproponuj 3 tytuły na viralowe wideo YouTube o zarabianiu w internecie", pro: false, icon: "🎬" },
  { id: "cyberpunk-avatar", name: "Cyberpunk avatar", prompt: "cyberpunk portrait, neon glow, detailed, futuristic, high quality", chatPrompt: "Napisz krótki opis postaci cyberpunkowej do bio na social media", pro: true, icon: "🤖" },
  { id: "fantasy-landscape", name: "Fantasy landscape", prompt: "epic fantasy landscape, mountains, sunset, mystical atmosphere, detailed", chatPrompt: "Napisz poetycki opis tego fantasy krajobrazu, 2-3 zdania", pro: true, icon: "🏔️" },
  { id: "ai-business", name: "AI Business Concept", prompt: "modern AI business workspace, futuristic, minimalistic, professional", chatPrompt: "Zaproponuj 3 pomysły na biznes oparty na AI w 2025 roku", pro: true, icon: "🧠" },
  { id: "viral-meme", name: "Viral Meme Image", prompt: "funny viral meme template, bold text space, colorful, high detail", chatPrompt: "Wymyśl zabawny mem o programistach i AI – format: góra/dół tekst", pro: true, icon: "😂" },
  { id: "crypto-dashboard", name: "Crypto Dashboard", prompt: "crypto trading dashboard, holographic UI, futuristic, dark theme", chatPrompt: "Opisz idealny dashboard do tradingu krypto – jakie metryki powinien zawierać?", pro: true, icon: "📊" },
  { id: "luxury-car", name: "Luxury Car Promo", prompt: "sports car, neon city background, cinematic lighting, high detail", chatPrompt: "Napisz reklamowy post o luksusowym samochodzie – styl premium, z emoji", pro: true, icon: "🏎️" },
  { id: "motivational", name: "Motivational Poster", prompt: "motivational poster, strong typography, inspiring background, premium", chatPrompt: "Napisz 3 motywujące cytaty o sukcesie i determinacji", pro: true, icon: "💪" },
];

const RANDOM_PROMPTS = [
  { prompt: "funny meme, neon colors, viral style, cartoonish", chat: "Wygeneruj zabawny opis do tego viralowego obrazka – z emoji i hashtagami" },
  { prompt: "futuristic trading chart, viral TikTok style, glowing", chat: "Napisz viralowy komentarz o tradingu do tego obrazka" },
  { prompt: "luxury crypto lifestyle, neon city, cinematic, dramatic", chat: "Napisz motywujący opis o sukcesie w krypto" },
  { prompt: "epic fantasy landscape, dramatic lighting, mystical", chat: "Napisz poetycki opis tego krajobrazu" },
  { prompt: "motivational poster, bold typography, bright colors, inspiring", chat: "Wymyśl 3 motywujące cytaty" },
  { prompt: "cyberpunk avatar, neon city, detailed, futuristic portrait", chat: "Napisz bio postaci cyberpunkowej" },
];

interface LeaderboardEntry {
  id: string;
  username: string | null;
  points: number;
}

export default function TemplatesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { profile, isPro, canChat, canGenerateImage, decrementChat, decrementImages } = useProfile();
  const { chatLeft, imagesLeft, maxChat, maxImages, decrementChat: decrementFreeChat, decrementImages: decrementFreeImages } = useFreeLimits();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState<string | null>(null);
  const [result, setResult] = useState<{ imageUrl: string; chatReply: string; templateName: string } | null>(null);
  const [editedText, setEditedText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Determine current limits for FOMO
  const currentImagesLeft = user && profile ? profile.free_images_left : imagesLeft;
  const currentChatLeft = user && profile ? profile.free_chat_left : chatLeft;
  const showFomo = !isPro && (currentImagesLeft <= 2 || currentChatLeft <= 3);
  const showCritical = !isPro && (currentImagesLeft <= 1 || currentChatLeft <= 1);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("leaderboard");
      if (!error && data) setLeaderboard(data);
    } catch {}
  };

  const addPoints = async (pts: number) => {
    if (!user || !profile) return;
    await supabase
      .from("profiles" as any)
      .update({ points: (profile as any).points + pts } as any)
      .eq("id", user.id);
    fetchLeaderboard();
  };

  const handleGenerate = async (template: Template) => {
    if (template.pro && !isPro) {
      toast.error(t.templates.proOnly);
      navigate("/pricing");
      return;
    }
    if (!isPro && (!canGenerateImage || !canChat)) {
      toast.error(t.pricing.limitReached);
      navigate("/pricing");
      return;
    }

    setGenerating(template.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-template", {
        body: { imagePrompt: template.prompt, chatPrompt: template.chatPrompt },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult({ imageUrl: data.imageUrl, chatReply: data.chatReply, templateName: template.name });

      if (!isPro) {
        if (user) { decrementChat(); decrementImages(); } 
        else { decrementFreeChat(); decrementFreeImages(); }
      }
      await addPoints(2);
    } catch (err: any) {
      toast.error(err.message || t.templates.error);
    } finally {
      setGenerating(null);
    }
  };

  const handleRandom = async () => {
    if (!isPro && (!canGenerateImage || !canChat)) {
      toast.error(t.pricing.limitReached);
      navigate("/pricing");
      return;
    }

    const rand = RANDOM_PROMPTS[Math.floor(Math.random() * RANDOM_PROMPTS.length)];
    setGenerating("random");
    try {
      const { data, error } = await supabase.functions.invoke("generate-template", {
        body: { imagePrompt: rand.prompt, chatPrompt: rand.chat },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult({ imageUrl: data.imageUrl, chatReply: data.chatReply, templateName: t.templates.randomTitle });

      if (!isPro) {
        if (user) { decrementChat(); decrementImages(); }
        else { decrementFreeChat(); decrementFreeImages(); }
      }
      await addPoints(3); // bonus for random
    } catch (err: any) {
      toast.error(err.message || t.templates.error);
    } finally {
      setGenerating(null);
    }
  };

  const handleDownload = () => {
    if (!result?.imageUrl) return;
    const link = document.createElement("a");
    link.href = result.imageUrl;
    link.download = `${result.templateName}.png`;
    link.click();
  };

  return (
    <Layout>
      <div className="flex flex-col h-full absolute inset-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto w-full px-4 md:px-8 py-8 space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-display font-bold mb-2">{t.templates.title}</h1>
            <p className="text-muted-foreground">{t.templates.subtitle}</p>
          </div>

          {/* FOMO Banner */}
          <AnimatePresence>
            {showFomo && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  "rounded-2xl p-4 flex items-center gap-3 border",
                  showCritical
                    ? "bg-destructive/10 border-destructive/30"
                    : "bg-primary/10 border-primary/30"
                )}
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <AlertTriangle className={cn("w-5 h-5", showCritical ? "text-destructive" : "text-primary")} />
                </motion.div>
                <div className="flex-1">
                  <p className={cn("text-sm font-semibold", showCritical ? "text-destructive" : "text-primary")}>
                    {showCritical ? t.templates.fomoCritical : t.templates.fomoWarning}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    💬 {currentChatLeft}/{user ? 20 : maxChat} · 🖼 {currentImagesLeft}/{user ? 5 : maxImages}
                  </p>
                </div>
                <button
                  onClick={() => navigate("/pricing")}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105",
                    showCritical
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  {t.templates.goProBtn}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Random Generator */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRandom}
            disabled={!!generating}
            className={cn(
              "w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all text-primary font-semibold",
              generating === "random" && "animate-pulse ring-2 ring-primary"
            )}
          >
            {generating === "random" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Shuffle className="w-5 h-5" />
            )}
            {t.templates.randomBtn}
          </motion.button>

          {/* Template Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {TEMPLATES.map((template) => {
              const isLocked = template.pro && !isPro;
              const isGenerating = generating === template.id;
              return (
                <motion.button
                  key={template.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleGenerate(template)}
                  disabled={!!generating}
                  className={cn(
                    "relative flex flex-col items-center gap-2 p-4 rounded-2xl border text-center transition-all",
                    isLocked
                      ? "bg-card/50 border-border/50 opacity-70"
                      : "bg-card border-border hover:border-primary/50",
                    isGenerating && "ring-2 ring-primary animate-pulse"
                  )}
                >
                  {template.pro && (
                    <span className="absolute top-2 right-2 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5">
                      <Crown className="w-3 h-3" /> PRO
                    </span>
                  )}
                  <span className="text-3xl">{template.icon}</span>
                  <span className="text-xs font-medium text-foreground leading-tight">{template.name}</span>
                  {isLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
                  {isGenerating && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                </motion.button>
              );
            })}
          </div>

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-display font-bold text-lg flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-yellow-500" />
                {t.templates.leaderboard}
              </h3>
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm",
                      i === 0 ? "bg-yellow-500/10 border border-yellow-500/20" :
                      i === 1 ? "bg-muted/50 border border-border/50" :
                      i === 2 ? "bg-orange-500/5 border border-orange-500/10" :
                      "border border-transparent"
                    )}
                  >
                    <span className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      i === 0 ? "bg-yellow-500 text-yellow-950" :
                      i === 1 ? "bg-muted-foreground/30 text-foreground" :
                      i === 2 ? "bg-orange-500/30 text-orange-200" :
                      "bg-secondary text-secondary-foreground"
                    )}>
                      {i + 1}
                    </span>
                    <span className="flex-1 font-medium text-foreground truncate">
                      {entry.username || entry.id.slice(0, 8) + "..."}
                    </span>
                    <span className="text-xs text-muted-foreground font-semibold">{entry.points} pkt</span>
                    {user?.id === entry.id && (
                      <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-bold">
                        {t.templates.you}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Points display for logged in user */}
          {user && profile && (
            <div className="text-center text-sm text-muted-foreground">
              {t.templates.yourPoints}: <span className="font-bold text-foreground">{(profile as any).points || 0}</span> pkt
            </div>
          )}

          {/* Result Modal */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setResult(null)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-lg flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      {result.templateName}
                    </h3>
                    <button onClick={() => setResult(null)} className="p-1 hover:bg-secondary rounded-lg">
                      <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </div>
                  <img src={result.imageUrl} alt={result.templateName} className="w-full rounded-xl border border-border" />
                  <div className="bg-secondary/50 rounded-xl p-4 text-sm text-foreground whitespace-pre-wrap">
                    {result.chatReply}
                  </div>
                  <button
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  >
                    <Download className="w-4 h-4" />
                    {t.templates.download}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
