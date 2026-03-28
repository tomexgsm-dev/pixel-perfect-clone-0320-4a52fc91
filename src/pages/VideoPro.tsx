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
      toast({ title: "Błąd", description: "Wpisz opis wideo przed generowaniem.", variant: "destructive" });
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

      const { data, error } = await supabase.functions.invoke("video-pro", {
        body,
      });

      if (error) {
        console.error("Edge function error:", error);
        const msg = "Usługa generowania wideo jest tymczasowo niedostępna. Spróbuj ponownie później.";
        setErrorMessage(msg);
        toast({ title: "Błąd generowania", description: msg, variant: "destructive" });
        return;
      }

      if (data?.error) {
        const apiMsg = data.error.includes("404")
          ? "Zewnętrzne API wideo jest niedostępne. Sprawdź konfigurację lub spróbuj później."
          : data.error;
        setErrorMessage(apiMsg);
        toast({ title: "Błąd API", description: apiMsg, variant: "destructive" });
        return;
      }

      if (!data?.video_url) {
        const msg = "Nie otrzymano adresu URL wideo. Spróbuj ponownie.";
        setErrorMessage(msg);
        toast({ title: "Błąd", description: msg, variant: "destructive" });
        return;
      }

      const url = data.video_url as string;
      setVideoUrl(url);
      toast({ title: "Sukces!", description: "Wideo zostało wygenerowane." });

      const file = await fetchAsFile(url, "generated-video.mp4");
      await saveVideoToGallery(file, { prompt, style, duration, ratio, resolution });

      const updated = await getVideoGallery();
      setGallery(updated as VideoRecord[]);
    } catch (e: unknown) {
      console.error(e);
      const msg = "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.";
      setErrorMessage(msg);
      toast({ title: "Błąd", description: msg, variant: "destructive" });
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <select
              className="bg-[#0b0b12] border border-[#262637] rounded-md p-2"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            >
              <option value="cinematic">Cinematic</option>
              <option value="anime">Anime</option>
              <option value="realistic">Realistic</option>
              <option value="advertising">Advertising</option>
              <option value="tutorial">Tutorial</option>
              <option value="tiktok">TikTok style</option>
              <option value="youtube">YouTube style</option>
              <option value="product">Product showcase</option>
              <option value="storytelling">Storytelling</option>
            </select>

            <select
              className="bg-[#0b0b12] border border-[#262637] rounded-md p-2"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
            </select>

            <select
              className="bg-[#0b0b12] border border-[#262637] rounded-md p-2"
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
            >
              <option value="16:9">16:9 (YouTube)</option>
              <option value="9:16">9:16 (TikTok / Reels)</option>
              <option value="1:1">1:1 (Social)</option>
            </select>

            <select
              className="bg-[#0b0b12] border border-[#262637] rounded-md p-2"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-3 text-xs">
            <label className="cursor-pointer bg-[#0b0b12] border border-[#262637] rounded-md px-3 py-2">
              🖼 Image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setImageFile(file);
                }}
              />
            </label>

            <label className="cursor-pointer bg-[#0b0b12] border border-[#262637] rounded-md px-3 py-2">
              🧑 Avatar
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setAvatarFile(file);
                }}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3 mt-2 text-sm">
            <button
              onClick={() => handleGenerate("text")}
              disabled={isLoading}
              className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-50"
            >
              🎬 Generate
            </button>
            <button
              onClick={() => handleGenerate("image")}
              disabled={isLoading || !imageFile}
              className="px-4 py-2 rounded-md bg-[#0b0b12] border border-[#262637] hover:border-purple-500 disabled:opacity-50"
            >
              🖼 Image to Video
            </button>
            <button
              onClick={() => handleGenerate("avatar")}
              disabled={isLoading || !avatarFile}
              className="px-4 py-2 rounded-md bg-[#0b0b12] border border-[#262637] hover:border-purple-500 disabled:opacity-50"
            >
              🧑 Avatar Video
            </button>
            <button
              onClick={() => handleGenerate("music")}
              disabled={isLoading}
              className="px-4 py-2 rounded-md bg-[#0b0b12] border border-[#262637] hover:border-purple-500 disabled:opacity-50"
            >
              🎵 Music Video
            </button>
            <button
              onClick={() => handleGenerate("social")}
              disabled={isLoading}
              className="px-4 py-2 rounded-md bg-[#0b0b12] border border-[#262637] hover:border-purple-500 disabled:opacity-50"
            >
              📱 Social Video
            </button>
          </div>

          {/* ⭐ NOWY LOADER */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-purple-300 animate-pulse">
                Generowanie wideo… proszę czekać
              </p>
            </div>
          )}

          {errorMessage && !isLoading && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              <span className="text-lg">⚠️</span>
              <div className="flex-1">
                <p className="font-medium text-red-200">Błąd generowania</p>
                <p className="mt-1">{errorMessage}</p>
              </div>
              <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-200 text-xs">✕</button>
            </div>
          )}
        </div>

        {/* PREVIEW */}
        <div className="bg-[#0b0b12] border border-[#262637] rounded-xl p-4 flex flex-col gap-3">
          <div className="text-sm font-medium">Preview</div>
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              className="w-full rounded-md border border-[#262637]"
            />
          ) : (
            <div className="w-full aspect-video rounded-md border border-dashed border-[#262637] flex items-center justify-center text-xs text-[#6b6b7f]">
              Generated video will appear here
            </div>
          )}
          {videoUrl && (
            <a
              href={videoUrl}
              download
              className="mt-2 inline-flex justify-center px-4 py-2 rounded-md bg-[#0b0b12] border border-[#262637] hover:border-purple-500 text-xs"
            >
              ⬇ Download video
            </a>
          )}
        </div>
      </div>

      {/* HISTORY */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#e5e5ff]">
            Video history
          </h2>
        </div>
        {gallery.length === 0 ? (
          <div className="text-xs text-[#6b6b7f]">
            No videos yet. Generate your first clip.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {gallery.map((video) => (
              <div
                key={video.id}
                className="bg-[#0b0b12] border border-[#262637] rounded-lg p-3 flex flex-col gap-2"
              >
                <video
                  src={video.url}
                  controls
                  className="w-full rounded-md"
                />
                <div className="text-xs line-clamp-2 text-[#c5c5dd]">
                  {video.prompt}
                </div>
                <div className="flex justify-between items-center text-[10px] text-[#7b7b93]">
                  <span>{video.style}</span>
                  <span>
                    {video.duration}s • {video.ratio} • {video.resolution}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(video.id, video.url)}
                  className="mt-1 text-[11px] text-red-400 hover:text-red-300 self-end"
                >
                  🗑 Delete
                </button>
              </div>
            ))}
          </div>
        )}
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
