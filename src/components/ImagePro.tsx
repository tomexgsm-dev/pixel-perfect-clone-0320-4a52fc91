import { useState, useRef } from "react";
import { Loader2, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { generateImage } from "@/lib/api/image";

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

const PRESETS: Record<string, string> = {
  generate: "",
  product: "product photography, studio light, high detail",
  logo: "vector logo, clean minimalistic, flat design",
  banner: "web banner, 16:9, modern, high contrast",
  social: "instagram post, vibrant colors, aesthetic",
  restore: "",
  upscale: "",
  colorize: "",
};

export default function ImagePro() {
  const { lang } = useI18n();

  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);

  const [uploaded, setUploaded] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);

  const [uploaded2, setUploaded2] = useState<File | null>(null);
  const [uploadedPreview2, setUploadedPreview2] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [progress, setProgress] = useState(0);
  const [gallery, setGallery] = useState<string[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const fileRef2 = useRef<HTMLInputElement>(null);

  /* ---------------- GENERATE ---------------- */

  const callAPI = async (action: string) => {
    setLoading(true);
    setProgress(5);
    setImage(null);

    const interval = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + 4));
    }, 700);

    try {
      const preset = PRESETS[action] || "";
      const finalPrompt = `${preset} ${prompt}`.trim();

      const fileToSend =
        ["restore", "upscale", "colorize"].includes(action)
          ? uploaded || uploaded2
          : undefined;

      const resultUrl = await generateImage(
        action,        // ← poprawne
        finalPrompt,   // ← poprawne
        fileToSend     // ← poprawne
      );

      clearInterval(interval);

      if (!resultUrl) {
        toast.error("AI returned empty result");
        setProgress(0);
        return;
      }

      setImage(resultUrl);
      setGallery((g) => [resultUrl, ...g.slice(0, 7)]);
      setProgress(100);

      toast.success("Done");
    } catch (err) {
      console.error(err);
      toast.error("Connection error");
      setProgress(0);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 500);
    }
  };

  /* ---------------- UPLOAD ---------------- */

  const uploadFile = async (file: File, setPreview: any, setFile: any) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Select image");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Max 10MB");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    setFile(file);
  };

  /* ---------------- CLEAR ---------------- */

  const clearUploads = () => {
    if (uploadedPreview) URL.revokeObjectURL(uploadedPreview);
    if (uploadedPreview2) URL.revokeObjectURL(uploadedPreview2);

    setUploaded(null);
    setUploadedPreview(null);

    setUploaded2(null);
    setUploadedPreview2(null);
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">🔥 NEXUS IMAGE PRO</h1>

      <input
        className="p-3 w-full mb-4 bg-card border border-border rounded-xl"
        placeholder={lang === "pl" ? "Opisz obraz..." : "Describe image..."}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {ACTIONS.map((a) => {
          const disabled =
            loading ||
            uploading ||
            (a.needsPrompt && !prompt.trim()) ||
            (a.needsImage && !uploaded && !uploaded2);

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

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file, setUploadedPreview, setUploaded);
            }}
          />

          {uploadedPreview && (
            <img
              src={uploadedPreview}
              className="mt-2 rounded-xl max-h-[200px]"
            />
          )}
        </div>

        <div>
          <input
            ref={fileRef2}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file, setUploadedPreview2, setUploaded2);
            }}
          />

          {uploadedPreview2 && (
            <img
              src={uploadedPreview2}
              className="mt-2 rounded-xl max-h-[200px]"
            />
          )}
        </div>
      </div>

      <button
        onClick={clearUploads}
        className="flex items-center gap-2 text-sm mb-4 text-muted-foreground"
      >
        <Trash2 className="w-4 h-4" />
        Clear uploads
      </button>

      {loading && (
        <div className="mb-4">
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className="bg-primary h-3 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-sm mt-1">AI generating {progress}%</p>
        </div>
      )}

      {image && (
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <img
            src={image}
            className="rounded-xl w-full max-h-[500px] object-contain"
          />

          <a href={image} download target="_blank">
            <button className="flex items-center gap-2 mt-3 px-4 py-2 bg-secondary rounded-xl">
              <Download className="w-4 h-4" />
              Download
            </button>
          </a>
        </div>
      )}

      {gallery.length > 0 && (
        <div>
          <p className="text-sm mb-2 text-muted-foreground">
            Last generations
          </p>

          <div className="grid grid-cols-4 gap-2">
            {gallery.map((img, i) => (
              <img
                key={i}
                src={img}
                className="rounded-lg cursor-pointer"
                onClick={() => setImage(img)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

