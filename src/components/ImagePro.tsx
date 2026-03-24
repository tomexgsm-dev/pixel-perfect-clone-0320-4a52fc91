import { useState, useRef } from "react";
import { Loader2, Download, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

const ACTIONS = [
  { key: "generate", label: "🎨 Generuj", needsPrompt: true, needsImage: false },
  { key: "product", label: "🛍️ Produkt", needsPrompt: true, needsImage: false },
  { key: "logo", label: "🧠 Logo", needsPrompt: true, needsImage: false },
  { key: "banner", label: "🖼️ Banner", needsPrompt: true, needsImage: false },
  { key: "social", label: "📱 Social", needsPrompt: true, needsImage: false },
  { key: "restore", label: "✨ Restore", needsPrompt: false, needsImage: true },
  { key: "upscale", label: "📈 HD", needsPrompt: false, needsImage: true },
  { key: "colorize", label: "🎨 Koloruj", needsPrompt: false, needsImage: true },
] as const;

export default function ImagePro() {
  const { lang } = useI18n();

  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [gallery, setGallery] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------------- API CALL ---------------- */

  const callAPI = async (action: string) => {
    setLoading(true);
    setProgress(5);
    setImage(null);

    try {
      const progressInterval = setInterval(() => {
        setProgress((p) => {
          if (p >= 90) return p;
          return p + 4;
        });
      }, 700);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-pro`, {
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
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "AI error");
        setProgress(0);
        return;
      }

      const data = await res.json();

      setProgress(100);
      setImage(data.image);

      setGallery((g) => [data.image, ...g.slice(0, 7)]);

      toast.success(lang === "pl" ? "Gotowe!" : "Done!");
    } catch {
      toast.error(lang === "pl" ? "Błąd połączenia" : "Connection error");
      setProgress(0);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 600);
    }
  };

  /* ---------------- UPLOAD ---------------- */

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Select image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Max 10MB");
      return;
    }

    setUploadedPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `image-pro/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage.from("chat-attachments").upload(path, file);

      if (error) throw error;

      const { data } = supabase.storage.from("chat-attachments").getPublicUrl(path);

      setUploaded(data.publicUrl);
    } catch {
      toast.error("Upload error");
      setUploadedPreview(null);
      setUploaded(null);
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  /* ---------------- CLEAR ---------------- */

  const clearUpload = () => {
    setUploaded(null);
    setUploadedPreview(null);
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">🔥 IMAGE PRO AI</h1>

      <input
        className="p-3 w-full mb-3 bg-card border border-border rounded-xl text-foreground"
        placeholder={lang === "pl" ? "Opisz obraz który AI ma wygenerować..." : "Describe image to generate..."}
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
              className="px-4 py-2 rounded-xl text-sm bg-card border border-border hover:bg-accent disabled:opacity-40"
            >
              {a.label}
            </button>
          );
        })}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileInput} className="mb-4" />

      {loading && (
        <div className="mb-4">
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div className="bg-primary h-3 transition-all" style={{ width: `${progress}%` }} />
          </div>

          <p className="text-sm text-muted-foreground mt-1">🤖 AI Generating... {progress}%</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {uploadedPreview && (
          <div className="bg-card border border-border rounded-2xl p-3">
            <div className="flex justify-between mb-2 text-sm text-muted-foreground">
              <span>📤 Upload</span>

              <button onClick={clearUpload}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <img src={uploadedPreview} className="rounded-xl w-full object-contain max-h-[400px]" />
          </div>
        )}

        {image && (
          <div className="bg-card border border-border rounded-2xl p-3">
            <p className="text-sm text-muted-foreground mb-2">🤖 AI Result</p>

            <img src={image} className="rounded-xl w-full object-contain max-h-[400px]" />

            <div className="flex gap-2 mt-3">
              <a href={image} download target="_blank">
                <button className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-xl text-sm">
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </a>

              <button
                onClick={() => callAPI("generate")}
                className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-xl text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Again
              </button>
            </div>
          </div>
        )}
      </div>

      {gallery.length > 0 && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground mb-2">🖼 Last generations</p>

          <div className="grid grid-cols-4 gap-2">
            {gallery.map((img, i) => (
              <img
                key={i}
                src={img}
                className="rounded-lg cursor-pointer hover:opacity-80"
                onClick={() => setImage(img)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
