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

  // 🔥 NOWE FEATURE
  const [avatar, setAvatar] = useState("avatar1");
  const [voice, setVoice] = useState("voice1");
  const [template, setTemplate] = useState("none");
  const [scenes, setScenes] = useState([{ text: "" }]);

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

        // 🔥 NOWE
        avatar,
        voice,
        template,
        scenes,
      };

      if (mode === "image" && imageFile) {
        body.image = await fileToBase64(imageFile);
      }

      if (mode === "avatar" && avatarFile) {
        body.avatarImage = await fileToBase64(avatarFile);
      }

      const { data, error } = await supabase.functions.invoke("clever-api", {
        body,
      });

      if (error) {
        console.error(error);
        setErrorMessage("API error");
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
      setErrorMessage("Server error");
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

          {/* TEMPLATE */}
          <select
            value={template}
            onChange={(e) => {
              const val = e.target.value;
              setTemplate(val);

              if (val === "ad") setPrompt("Create product advertisement");
              if (val === "tiktok") setPrompt("Create viral TikTok video");
              if (val === "story") setPrompt("Tell cinematic story");
            }}
            className="bg-[#0b0b12] border p-2 rounded"
          >
            <option value="none">No template</option>
            <option value="ad">Ad</option>
            <option value="tiktok">TikTok</option>
            <option value="story">Story</option>
          </select>

          {/* PROMPT */}
          <textarea
            className="w-full bg-[#0b0b12] border p-3 rounded"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          {/* AVATAR */}
          <div className="grid grid-cols-3 gap-2">
            {["avatar1", "avatar2", "avatar3"].map((a) => (
              <div
                key={a}
                onClick={() => setAvatar(a)}
                className={`p-2 border rounded cursor-pointer ${
                  avatar === a ? "border-purple-500" : "border-gray-700"
                }`}
              >
                <div className="h-16 bg-black rounded mb-1"></div>
                <div className="text-xs text-center">{a}</div>
              </div>
            ))}
          </div>

          {/* VOICE */}
          <div className="flex gap-2">
            {["voice1", "voice2"].map((v) => (
              <button
                key={v}
                onClick={() => setVoice(v)}
                className={`px-3 py-1 rounded ${
                  voice === v ? "bg-purple-600" : "bg-gray-700"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* SCENES */}
          {scenes.map((scene, i) => (
            <input
              key={i}
              value={scene.text}
              onChange={(e) => {
                const copy = [...scenes];
                copy[i].text = e.target.value;
                setScenes(copy);
              }}
              className="p-2 bg-[#0b0b12] border rounded"
              placeholder={`Scene ${i + 1}`}
            />
          ))}

          <button onClick={() => setScenes([...scenes, { text: "" }])}>
            + Scene
          </button>

          {/* BUTTON */}
          <button
            onClick={() => handleGenerate("text")}
            disabled={isLoading}
            className="bg-purple-600 p-3 rounded"
          >
            Generate Video
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
