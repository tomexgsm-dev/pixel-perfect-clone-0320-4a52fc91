import { useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Loader2, Wand2, ShoppingBag, ArrowUpCircle, Palette, Sparkles, Download, Upload, X, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const ACTIONS = [
  { key: "generate", icon: Wand2, needsPrompt: true, needsImage: false },
  { key: "product", icon: ShoppingBag, needsPrompt: true, needsImage: false },
  { key: "upscale", icon: ArrowUpCircle, needsPrompt: false, needsImage: true },
  { key: "coloring", icon: Palette, needsPrompt: false, needsImage: true },
  { key: "enhance", icon: Sparkles, needsPrompt: false, needsImage: true },
] as const;

const ACTION_LABELS: Record<string, { en: string; pl: string; desc_en: string; desc_pl: string }> = {
  generate: { en: "Generate", pl: "Generuj obraz", desc_en: "Create image from text prompt", desc_pl: "Stwórz obraz z opisu tekstowego" },
  product: { en: "Product Shot", pl: "Zdjęcie produktu", desc_en: "Marketing product photo", desc_pl: "Marketingowe zdjęcie produktu" },
  upscale: { en: "Upscale HD", pl: "Powiększ HD", desc_en: "Upscale image to HD quality", desc_pl: "Powiększ obraz do jakości HD" },
  coloring: { en: "Coloring Page", pl: "Kolorowanka", desc_en: "Convert to line art", desc_pl: "Zamień na kolorowankę" },
  enhance: { en: "Enhance", pl: "Popraw jakość", desc_en: "Improve photo quality", desc_pl: "Popraw jakość zdjęcia" },
};

export default function ImageProPage() {
  const [selectedAction, setSelectedAction] = useState<string>("generate");
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { lang } = useI18n();

  const action = ACTIONS.find((a) => a.key === selectedAction)!;
  const labels = ACTION_LABELS[selectedAction];

  const handleSubmit = async () => {
    if (action.needsPrompt && !prompt.trim()) return;
    if (action.needsImage && !imageUrl.trim()) return;

    setLoading(true);
    setResultImage(null);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-pro`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            action: selectedAction,
            prompt: prompt.trim() || undefined,
            image: imageUrl.trim() || undefined,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || "Failed");
        return;
      }

      const data = await resp.json();
      setResultImage(data.image);
      toast.success(lang === "pl" ? "Gotowe!" : "Done!");
    } catch {
      toast.error("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-full absolute inset-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full px-4 md:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-1">Image Pro</h1>
            <p className="text-sm text-muted-foreground">
              {lang === "pl" ? "Zaawansowane narzędzia AI do obrazów (Replicate)" : "Advanced AI image tools (Replicate)"}
            </p>
          </div>

          {/* Action selector */}
          <div className="flex flex-wrap gap-2 mb-6">
            {ACTIONS.map((a) => {
              const Icon = a.icon;
              const l = ACTION_LABELS[a.key];
              return (
                <button
                  key={a.key}
                  onClick={() => { setSelectedAction(a.key); setResultImage(null); }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border",
                    selectedAction === a.key
                      ? "bg-primary text-primary-foreground border-primary shadow-glow"
                      : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {lang === "pl" ? l.pl : l.en}
                </button>
              );
            })}
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-4">
            {lang === "pl" ? labels.desc_pl : labels.desc_en}
          </p>

          {/* Input area */}
          <div className="space-y-3 mb-8">
            {action.needsPrompt && (
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={lang === "pl" ? "Opisz co chcesz wygenerować..." : "Describe what you want to generate..."}
                rows={3}
                className="w-full resize-none bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            )}

            {action.needsImage && (
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder={lang === "pl" ? "Wklej URL obrazu..." : "Paste image URL..."}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || (action.needsPrompt && !prompt.trim()) || (action.needsImage && !imageUrl.trim())}
              className={cn(
                "px-6 py-3 rounded-xl font-medium text-sm transition-all",
                !loading ? "bg-primary text-primary-foreground hover:scale-105 shadow-glow" : "bg-secondary text-muted-foreground"
              )}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {lang === "pl" ? "Przetwarzanie..." : "Processing..."}
                </span>
              ) : (
                lang === "pl" ? "Uruchom" : "Run"
              )}
            </button>
          </div>

          {/* Result */}
          {resultImage && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <img src={resultImage} alt="Result" className="w-full max-h-[600px] object-contain" />
              <div className="p-4 flex gap-2">
                <a
                  href={resultImage}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-xl text-sm hover:bg-secondary/80 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {lang === "pl" ? "Pobierz" : "Download"}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
