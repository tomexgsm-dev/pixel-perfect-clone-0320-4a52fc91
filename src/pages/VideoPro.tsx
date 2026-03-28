import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  saveVideoToGallery,
  getVideoGallery,
  deleteVideo,
} from "@/lib/api/video";

type VideoRecord = {
  id: string;
  url: string;
  prompt: string;
  style?: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
  created_at: string;
};

export default function VideoPro() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("cinematic");
  const [duration, setDuration] = useState(10);
  const [ratio, setRatio] = useState("16:9");
  const [resolution, setResolution] = useState("1080p");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [gallery, setGallery] = useState<VideoRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getVideoGallery();
        setGallery(data as VideoRecord[]);
      } catch (e) {
        console.error("Gallery error:", e);
      }
    })();
  }, []);

  async function handleGenerate(
    mode: "text" | "image" | "avatar" | "music" | "social"
  ) {
    if (!prompt.trim()) {
      toast({
        title: "Błąd",
        description: "Wpisz opis wideo przed generowaniem.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const body: Record<string, unknown> = {
        prompt,
        style,
        duration,
        ratio,
        resolution,
        mode,
      };

      if (mode === "image" && imageFile) {
        body.image = await fileToBase64(imageFile);
      }

      if (mode === "avatar" && avatarFile) {
        body.avatar = await fileToBase64(avatarFile);
      }

      // ✅ TIMEOUT (ważne)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      const { data, error } = await supabase.functions.invoke("clever-api", {
        body,
        // @ts-ignore
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (error) {
        console.error("Edge function error:", error);

        const msg =
          error.message || "Edge function nie odpowiada (CORS / 500)";
        setErrorMessage(msg);

        toast({
          title: "Błąd generowania",
          description: msg,
          variant: "destructive",
        });
        return;
      }

      if (data?.error) {
        console.error("API error:", data.error);

        const apiMsg =
          typeof data.error === "string"
            ? data.error
            : "Błąd zewnętrznego API";

        setErrorMessage(apiMsg);

        toast({
          title: "Błąd API",
          description: apiMsg,
          variant: "destructive",
        });
        return;
      }

      if (!data?.video_url) {
        console.error("NO VIDEO URL:", data);

        const msg = "API nie zwróciło video_url";
        setErrorMessage(msg);

        toast({
          title: "Błąd",
          description: msg,
          variant: "destructive",
        });
        return;
      }

      const url = data.video_url as string;
      setVideoUrl(url);

      toast({
        title: "Sukces!",
        description: "Wideo zostało wygenerowane.",
      });

      const file = await fetchAsFile(url, "generated-video.mp4");

      await saveVideoToGallery(file, {
        prompt,
        style,
        duration,
        ratio,
        resolution,
      });

      const updated = await getVideoGallery();
      setGallery(updated as VideoRecord[]);
    } catch (e: any) {
      console.error("CRASH:", e);

      const msg =
        e.name === "AbortError"
          ? "Timeout – API nie odpowiedziało (60s)"
          : "Wystąpił nieoczekiwany błąd";

      setErrorMessage(msg);

      toast({
        title: "Błąd",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string, url: string) {
    await deleteVideo(id, url);
    setGallery((prev) => prev.filter((v) => v.id !== id));
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#050509] text-white min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <textarea
            className="w-full rounded-md bg-[#0b0b12] border border-[#262637] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            rows={4}
            placeholder="Describe your video idea..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          {/* RESZTA UI BEZ ZMIAN */}
          
          {/* ... NIC NIE RUSZAM */}
          
          <div className="flex flex-wrap gap-3 mt-2 text-sm">
            <button
              onClick={() => handleGenerate("text")}
              disabled={isLoading}
              className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-50"
            >
              🎬 Generate
            </button>
          </div>

          {errorMessage && !isLoading && (
            <div className="text-red-400 text-sm">{errorMessage}</div>
          )}
        </div>

        <div className="bg-[#0b0b12] border border-[#262637] rounded-xl p-4">
          {videoUrl ? (
            <video src={videoUrl} controls className="w-full" />
          ) : (
            <div>Preview</div>
          )}
        </div>
      </div>
    </div>
  );
}

// helpers (bez zmian)
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fetchAsFile(url: string, filename: string): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}
