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
        const msg =
          "Usługa generowania wideo jest tymczasowo niedostępna.";
        setErrorMessage(msg);
        toast({
          title: "Błąd generowania",
          description: msg,
          variant: "destructive",
        });
        return;
      }

      if (!data?.video_url) {
        const msg = "Nie otrzymano URL wideo.";
        setErrorMessage(msg);
        return;
      }

      const url = data.video_url as string;
      setVideoUrl(url);

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
    } catch (e) {
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <textarea
            className="w-full bg-[#0b0b12] border p-3"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <button
            onClick={() => handleGenerate("text")}
            disabled={isLoading}
          >
            Generate
          </button>

          {errorMessage && <div>{errorMessage}</div>}
        </div>

        {/* RIGHT */}
        <div className="bg-[#0b0b12] border p-4">
          {videoUrl ? (
            <video src={videoUrl} controls />
          ) : (
            <div>Preview</div>
          )}
        </div>

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
