import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Loader2, Download, Trash2, Image as ImageIcon, Crown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useFreeLimits } from "@/hooks/use-free-limits";
import { Link } from "react-router-dom";

const QUICK_STYLES = [
  { key: "anime", prefix: "Anime style portrait, " },
  { key: "photo", prefix: "Photorealistic, " },
  { key: "watercolor", prefix: "Watercolor painting, " },
  { key: "pixel", prefix: "Pixel art style, " },
  { key: "oil", prefix: "Oil painting style, " },
  { key: "cinematic", prefix: "Cinematic movie still, " },
] as const;

export default function ImagesPage() {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [pastedImage, setPastedImage] = useState<{ file: File; preview: string } | null>(null);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setPastedImage({ file, preview: URL.createObjectURL(file) });
          if (!prompt.trim()) setPrompt("Pasted screenshot");
        }
        return;
      }
    }
  };

  const removePastedImage = () => {
    if (pastedImage) {
      URL.revokeObjectURL(pastedImage.preview);
      setPastedImage(null);
    }
  };
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { user } = useAuth();
  const { isPro } = useProfile();
  const freeLimits = useFreeLimits();

  const canGenerateImage = user && isPro ? true : freeLimits.canGenerateImage;

  const { data: images, isLoading } = useQuery({
    queryKey: ["generated-images"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_images")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("generated_images").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["generated-images"] }),
  });

  const handleGenerate = async (finalPrompt?: string) => {
    const p = finalPrompt || prompt.trim();
    if (!p || !canGenerateImage) return;
    setGenerating(true);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ prompt: p }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || "Failed to generate image");
        return;
      }

      const data = await resp.json();

      await supabase.from("generated_images").insert({
        prompt: p,
        image_url: data.imageUrl,
        user_id: user?.id || null,
      });

      if (!(user && isPro)) freeLimits.decrementImages();
      queryClient.invalidateQueries({ queryKey: ["generated-images"] });
      setPrompt("");
      toast.success("Image generated!");
    } catch (err) {
      toast.error("Failed to generate image");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-full absolute inset-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full px-4 md:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-1">{t.images.title}</h1>
            <p className="text-sm text-muted-foreground">{t.images.subtitle}</p>
          </div>

          {!canGenerateImage && (
            <div className="mb-4 px-4 py-3 bg-card border border-border rounded-xl flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t.pricing.limitReached}</span>
              <Link to={user ? "/pricing" : "/auth"} className="flex items-center gap-1 text-primary font-medium text-sm hover:underline">
                <Crown className="w-4 h-4" /> {user ? "PRO" : t.auth.signupLink}
              </Link>
            </div>
          )}

          <div className="space-y-3 mb-8">
            {pastedImage && (
              <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
                <img src={pastedImage.preview} alt="Pasted" className="w-12 h-12 rounded-lg object-cover" />
                <p className="text-sm text-muted-foreground flex-1 truncate">{pastedImage.file.name || "Screenshot"}</p>
                <button onClick={removePastedImage} className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onPaste={handlePaste}
                placeholder={t.images.promptPlaceholder}
                rows={2}
                disabled={!canGenerateImage}
                className="flex-1 resize-none bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
              <button
                onClick={() => handleGenerate()}
                disabled={!prompt.trim() || generating || !canGenerateImage}
                className={cn(
                  "px-6 rounded-xl font-medium text-sm transition-all",
                  prompt.trim() && !generating && canGenerateImage
                    ? "bg-primary text-primary-foreground hover:scale-105 shadow-glow"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : t.images.generateBtn}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {QUICK_STYLES.map(style => (
                <button
                  key={style.key}
                  onClick={() => handleGenerate(style.prefix + (prompt || "beautiful scene"))}
                  disabled={generating || !canGenerateImage}
                  className="px-3 py-1.5 bg-card border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                >
                  {t.images.styles[style.key as keyof typeof t.images.styles]}
                </button>
              ))}
            </div>
          </div>

          {generating && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">{t.images.generating}</span>
            </div>
          )}

          <div className="mb-4">
            <h2 className="text-lg font-semibold">{t.images.myImages}</h2>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !images?.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{t.images.noImages}</p>
              <p className="text-sm mt-1">{t.images.noImagesHint}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {images.map(img => (
                <div key={img.id} className="group relative bg-card border border-border rounded-2xl overflow-hidden">
                  <img src={img.image_url} alt={img.prompt} className="w-full aspect-square object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-xs text-foreground line-clamp-2 mb-2">{img.prompt}</p>
                      <div className="flex gap-2">
                        <a href={img.image_url} download target="_blank" rel="noopener noreferrer" className="p-1.5 bg-secondary rounded-lg hover:bg-secondary/80 text-secondary-foreground">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => deleteMutation.mutate(img.id)} className="p-1.5 bg-destructive/20 rounded-lg hover:bg-destructive/30 text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
