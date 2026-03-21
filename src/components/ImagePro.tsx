import { useState, useRef } from "react";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

const ACTIONS = [
  { key: "generate", label: "🎨 Generuj", needsPrompt: true, needsImage: false },
  { key: "product", label: "🛍️ Produkt", needsPrompt: true, needsImage: false },
  { key: "enhance", label: "✨ Popraw", needsPrompt: false, needsImage: true },
  { key: "upscale", label: "📈 HD", needsPrompt: false, needsImage: true },
  { key: "coloring", label: "✏️ Kolorowanka", needsPrompt: false, needsImage: true },
] as const;

export default function ImagePro() {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { lang } = useI18n();

  const callAPI = async (action: string) => {
    setLoading(true);
    setImage(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-pro`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            action,
            prompt: prompt.trim() || undefined,
            image: uploaded || undefined,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed");
        return;
      }
      const data = await res.json();
      setImage(data.image);
      toast.success("Gotowe!");
    } catch {
      toast.error("Błąd połączenia");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Wybierz plik obrazu"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Maks. 10MB"); return; }

    setUploadedPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `image-pro/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
      setUploaded(urlData.publicUrl);
    } catch {
      toast.error("Błąd uploadu");
      setUploadedPreview(null);
      setUploaded(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">🔥 IMAGE PRO AI</h1>

      <input
        className="p-3 w-full mb-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        placeholder={lang === "pl" ? "Opisz co AI ma zrobić..." : "Describe what AI should do..."}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {ACTIONS.map((a) => {
          const disabled = loading || uploading || (a.needsPrompt && !prompt.trim()) || (a.needsImage && !uploaded);
          return (
            <button
              key={a.key}
              onClick={() => callAPI(a.key)}
              disabled={disabled}
              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-card border border-border text-foreground hover:bg-accent hover:border-foreground/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {a.label}
            </button>
          );
        })}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="mb-4 text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-border file:bg-card file:text-foreground file:cursor-pointer"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {uploadedPreview && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden p-3">
            <p className="text-sm text-muted-foreground mb-2">📤 Upload</p>
            <img src={uploadedPreview} className="rounded-xl w-full object-contain max-h-[400px]" alt="Uploaded" />
          </div>
        )}

        {image && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden p-3">
            <p className="text-sm text-muted-foreground mb-2">🤖 AI</p>
            <img src={image} className="rounded-xl w-full object-contain max-h-[400px]" alt="AI Result" />
            <a href={image} download target="_blank" rel="noopener noreferrer">
              <button className="flex items-center gap-2 mt-3 px-4 py-2 bg-secondary text-secondary-foreground rounded-xl text-sm hover:bg-secondary/80 transition-colors">
                <Download className="w-4 h-4" /> ⬇️ Pobierz
              </button>
            </a>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 mt-4 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>⏳ AI pracuje...</span>
        </div>
      )}
    </div>
  );
}
