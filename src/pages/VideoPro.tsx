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
  const [tab, setTab] = useState<"script" | "avatar" | "voice">("script");

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
    getVideoGallery().then((d) => setGallery(d as VideoRecord[]));
  }, []);

  async function handleGenerate(
    mode: "text" | "image" | "avatar" | "music" | "social"
  ) {
    if (!prompt.trim()) return;

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

      if (mode === "image" && imageFile)
        body.image = await fileToBase64(imageFile);

      if (mode === "avatar" && avatarFile)
        body.avatar = await fileToBase64(avatarFile);

      const { data, error } = await supabase.functions.invoke("clever-api", {
        body,
      });

      if (error || !data?.video_url) {
        setErrorMessage("Błąd API");
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

      setGallery(await getVideoGallery());
    } catch {
      setErrorMessage("Server error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string, url: string) {
    await deleteVideo(id, url);
    setGallery((p) => p.filter((v) => v.id !== id));
  }

  return (
    <div className="flex h-screen bg-[#050509] text-white">

      {/* SIDEBAR */}
      <div className="w-64 bg-[#0b0b12] border-r border-[#262637] p-4 flex flex-col">
        <div className="text-lg font-semibold mb-6">Nexus AI</div>

        <button className="p-2 rounded bg-purple-600 mb-2">🎬 Video</button>
        <button className="p-2 rounded hover:bg-[#151521]">🖼 Image</button>
        <button className="p-2 rounded hover:bg-[#151521]">📁 History</button>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col">

        {/* TOPBAR */}
        <div className="h-14 border-b border-[#262637] flex items-center px-6">
          <div className="text-sm text-gray-400">Video Generator</div>
        </div>

        {/* CONTENT */}
        <div className="flex flex-1">

          {/* LEFT PANEL */}
          <div className="w-[420px] border-r border-[#262637] p-6 flex flex-col gap-4">

            {/* TABS */}
            <div className="flex gap-2 text-sm">
              {["script", "avatar", "voice"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t as any)}
                  className={`px-3 py-1 rounded ${
                    tab === t ? "bg-purple-600" : "bg-[#151521]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* SCRIPT TAB */}
            {tab === "script" && (
              <>
                <textarea
                  className="w-full h-32 bg-[#0b0b12] border border-[#262637] rounded p-3"
                  placeholder="Write your script..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-2">
                  <select value={style} onChange={(e) => setStyle(e.target.value)}>
                    <option value="cinematic">Cinematic</option>
                    <option value="anime">Anime</option>
                  </select>

                  <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                    <option value={5}>5s</option>
                    <option value={10}>10s</option>
                  </select>
                </div>
              </>
            )}

            {/* AVATAR TAB */}
            {tab === "avatar" && (
              <input type="file" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
            )}

            {/* VOICE TAB */}
            {tab === "voice" && (
              <div className="text-xs text-gray-400">
                Voice options (coming soon)
              </div>
            )}

            {/* ACTION */}
            <button
              onClick={() => handleGenerate("text")}
              className="bg-purple-600 p-3 rounded-lg mt-2"
            >
              Generate Video
            </button>

            {isLoading && <div className="text-xs">Generating...</div>}
            {errorMessage && <div className="text-red-400">{errorMessage}</div>}
          </div>

          {/* RIGHT PANEL */}
          <div className="flex-1 p-6 flex flex-col gap-4">

            <div className="text-sm text-gray-400">Preview</div>

            <div className="flex-1 flex items-center justify-center">
              {videoUrl ? (
                <video src={videoUrl} controls className="rounded-lg max-h-[400px]" />
              ) : (
                <div className="w-full max-w-2xl aspect-video border border-dashed border-[#262637] flex items-center justify-center text-gray-500">
                  Your video will appear here
                </div>
              )}
            </div>

            {/* HISTORY */}
            <div className="grid grid-cols-3 gap-3">
              {gallery.map((v) => (
                <div key={v.id} className="bg-[#0b0b12] p-2 rounded">
                  <video src={v.url} controls />
                  <button
                    onClick={() => handleDelete(v.id, v.url)}
                    className="text-red-400 text-xs"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// helpers
async function fileToBase64(file: File): Promise<string {
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
