import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useI18n } from "@/i18n";
import { useProfile } from "@/hooks/use-profile";
import { useFreeLimits } from "@/hooks/use-free-limits";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown, Loader2, Sparkles, Lock, Download, X } from "lucide-react";
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

export default function TemplatesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isPro, canChat, canGenerateImage, decrementChat, decrementImages } = useProfile();
  const { decrementChat: decrementFreeChat, decrementImages: decrementFreeImages } = useFreeLimits();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState<string | null>(null);
  const [result, setResult] = useState<{ imageUrl: string; chatReply: string; templateName: string } | null>(null);

  const handleGenerate = async (template: Template) => {
    if (template.pro && !isPro) {
      toast.error(t.templates.proOnly);
      navigate("/pricing");
      return;
    }

    if (!isPro) {
      if (!canGenerateImage || !canChat) {
        toast.error(t.pricing.limitReached);
        navigate("/pricing");
        return;
      }
    }

    setGenerating(template.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-template", {
        body: { imagePrompt: template.prompt, chatPrompt: template.chatPrompt },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult({ imageUrl: data.imageUrl, chatReply: data.chatReply, templateName: template.name });

      // Decrement limits
      if (!isPro) {
        if (user) {
          decrementChat();
          decrementImages();
        } else {
          decrementFreeChat();
          decrementFreeImages();
        }
      }
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
        <div className="max-w-5xl mx-auto w-full px-4 md:px-8 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold mb-2">{t.templates.title}</h1>
            <p className="text-muted-foreground">{t.templates.subtitle}</p>
          </div>

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
                      : "bg-card border-border hover:border-primary/50 hover:shadow-glow/10",
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

                  <img
                    src={result.imageUrl}
                    alt={result.templateName}
                    className="w-full rounded-xl border border-border"
                  />

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
