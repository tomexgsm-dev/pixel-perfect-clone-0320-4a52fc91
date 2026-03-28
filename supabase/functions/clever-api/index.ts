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

  // 🔥 NEW ULTRA FEATURES
  const [voiceId, setVoiceId] = useState("default");
  const [lipsync, setLipsync] = useState(true);
  const [platform, setPlatform] = useState("none");
  const [publishKey, setPublishKey] = useState("");

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
        console.error(e);
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

        // 🔥 NEW DATA DO API
        voiceId,
        lipsync,
        platform,
        publishKey,
      };

      if (mode === "image" && imageFile) {
        body.image = await fileToBase64(imageFile);
      }

      if (mode === "avatar" && avatarFile) {
        body.avatar = await fileToBase64(avatarFile);
      }

      const { data, error } = await supabase.functions.invoke("clever-api", {
        body,
      });

      if (error) {
        console.error("Edge function error:", error);
        const msg =
          "Usługa generowania wideo jest tymczasowo niedostępna.";
        setErrorMessage(msg);
        return;
      }

      if (data?.error) {
        setErrorMessage(data.error);
        return;
      }

      if (!data?.video_url) {
        setErrorMessage("Brak video URL");
        return;
      }

      const url = data.video_url as string;
      setVideoUrl(url);

      const file = await fetchAsFile(url, "video.mp4");
      await saveVideoToGallery(file, {
        prompt,
        style,
        duration,
        ratio,
        resolution,
      });

      const updated = await getVideoGallery();
      setGallery(updated as VideoRecord[]);
    } catch (e) {
      console.error(e);
      setErrorMessage("Błąd serwera");
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

      {/* INPUT */}
      <textarea
        className="w-full bg-[#0b0b12] border p-3"
        rows={4}
        placeholder="Describe your video..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      {/* 🔥 ULTRA SETTINGS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">

        <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
          <option value="default">Default voice</option>
          <option value="female">Female AI</option>
          <option value="male">Male AI</option>
          <option value="clone">Voice Clone</option>
        </select>

        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="none">No publish</option>
          <option value="tiktok">TikTok</option>
          <option value="youtube">YouTube</option>
          <option value="facebook">Facebook</option>
          <option value="x">X</option>
        </select>

        <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
          <option value={10}>10s</option>
          <option value={30}>30s</option>
          <option value={60}>1 min</option>
          <option value={180}>3 min</option>
        </select>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={lipsync}
            onChange={(e) => setLipsync(e.target.checked)}
          />
          Lipsync
        </label>
      </div>

      {/* 🔐 API KEY */}
      {platform !== "none" && (
        <input
          type="text"
          placeholder="API KEY do publikacji"
          value={publishKey}
          onChange={(e) => setPublishKey(e.target.value)}
          className="bg-[#0b0b12] border p-2"
        />
      )}

      {/* BUTTON */}
      <button
        onClick={() => handleGenerate("text")}
        disabled={isLoading}
        className="bg-purple-600 p-3 rounded"
      >
        {isLoading ? "Generowanie..." : "Generate PRO Video"}
      </button>

      {/* PREVIEW */}
      {videoUrl && <video src={videoUrl} controls />}

      {/* ERROR */}
      {errorMessage && <div className="text-red-400">{errorMessage}</div>}

      {/* HISTORY */}
      <div>
        {gallery.map((video) => (
          <div key={video.id}>
            <video src={video.url} controls />
            <button onClick={() => handleDelete(video.id, video.url)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// helpers
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
