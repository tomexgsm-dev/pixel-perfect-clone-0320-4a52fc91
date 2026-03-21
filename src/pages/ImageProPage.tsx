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
  const [uploadedFile, setUploadedFile] = useState<{ file: File; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [useUrlMode, setUseUrlMode] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { lang } = useI18n();

  const action = ACTIONS.find((a) => a.key === selectedAction)!;
  const labels = ACTION_LABELS[selectedAction];

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(lang === "pl" ? "Wybierz plik obrazu" : "Select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(lang === "pl" ? "Maks. 10MB" : "Max 10MB");
      return;
    }
    setUploadedFile({ file, preview: URL.createObjectURL(file) });

    // Upload to storage
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `image-pro/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
      setImageUrl(urlData.publicUrl);
    } catch {
      toast.error(lang === "pl" ? "Błąd uploadu" : "Upload failed");
      removeFile();
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    if (uploadedFile) URL.revokeObjectURL(uploadedFile.preview);
    setUploadedFile(null);
    setImageUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const hasImage = !!imageUrl.trim();

  const handleSubmit = async () => {
    if (action.needsPrompt && !prompt.trim()) return;
    if (action.needsImage && !hasImage) return;

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
              <div className="space-y-2">
                {/* Toggle between upload and URL */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setUseUrlMode(false); removeFile(); }}
                    className={cn("text-xs px-3 py-1 rounded-lg transition-colors", !useUrlMode ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}
                  >
                    <Upload className="w-3 h-3 inline mr-1" />
                    {lang === "pl" ? "Upload" : "Upload"}
                  </button>
                  <button
                    onClick={() => { setUseUrlMode(true); removeFile(); }}
                    className={cn("text-xs px-3 py-1 rounded-lg transition-colors", useUrlMode ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}
                  >
                    <LinkIcon className="w-3 h-3 inline mr-1" />
                    URL
                  </button>
                </div>

                {useUrlMode ? (
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder={lang === "pl" ? "Wklej URL obrazu..." : "Paste image URL..."}
                    className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                ) : (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                    />
                    {uploadedFile ? (
                      <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                        <img src={uploadedFile.preview} alt="Preview" className="w-14 h-14 rounded-lg object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{uploadedFile.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {uploading ? (lang === "pl" ? "Przesyłanie..." : "Uploading...") : (lang === "pl" ? "Gotowe" : "Ready")}
                          </p>
                        </div>
                        <button onClick={removeFile} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center gap-2 bg-card border-2 border-dashed border-border rounded-xl px-4 py-8 cursor-pointer hover:border-primary/50 transition-colors"
                      >
                        <Upload className="w-8 h-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {lang === "pl" ? "Kliknij lub przeciągnij obraz" : "Click or drag an image"}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || uploading || (action.needsPrompt && !prompt.trim()) || (action.needsImage && !hasImage)}
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
