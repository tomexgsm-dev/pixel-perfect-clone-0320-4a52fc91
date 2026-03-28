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
        console.error(error);
        setErrorMessage("API nie odpowiada");
        return;
      }

      if (!data?.video_url) {
        setErrorMessage("Brak video_url");
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
    <div className="p-6 text-white min-h-screen bg-black">

      <textarea
        className="w-full p-3 bg-[#111] border mb-3"
        placeholder="Describe your video idea..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      {/* OPTIONS */}
      <div className="flex gap-2 mb-3">
        <select value={style} onChange={(e) => setStyle(e.target.value)}>
          <option value="cinematic">cinematic</option>
          <option value="anime">anime</option>
          <option value="realistic">realistic</option>
        </select>

        <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={15}>15</option>
        </select>

        <select value={ratio} onChange={(e) => setRatio(e.target.value)}>
          <option value="16:9">16:9</option>
          <option value="9:16">9:16</option>
        </select>

        <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
          <option value="720p">720p</option>
          <option value="1080p">1080p</option>
        </select>
      </div>

      {/* FILES */}
      <div className="flex gap-2 mb-3">
        <input type="file" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
        <input type="file" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
      </div>

      {/* BUTTONS */}
      <div className="flex gap-2 mb-3">
        <button onClick={() => handleGenerate("text")}>Generate</button>
        <button onClick={() => handleGenerate("image")}>Image</button>
        <button onClick={() => handleGenerate("avatar")}>Avatar</button>
        <button onClick={() => handleGenerate("music")}>Music</button>
        <button onClick={() => handleGenerate("social")}>Social</button>
      </div>

      {isLoading && <div>Loading...</div>}
      {errorMessage && <div className="text-red-500">{errorMessage}</div>}

      {/* PREVIEW */}
      <div className="mb-4">
        {videoUrl ? <video src={videoUrl} controls /> : <div>Preview</div>}
      </div>

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
