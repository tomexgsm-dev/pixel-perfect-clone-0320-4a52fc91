import { useState } from "react";
import { generateVideo, VideoPayload } from "@/lib/videoService";
import { Button } from "@/components/ui/button";

interface Props {
  prompt: string;
  avatar?: string;
  voice?: string;
  scenes?: { text: string; duration?: number }[];
  style?: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
  mode?: string;
}

export default function GenerateVideoButton({
  prompt,
  avatar,
  voice,
  scenes,
  style,
  duration,
  ratio,
  resolution,
  mode,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Wpisz prompt przed generowaniem.");
      return;
    }

    setLoading(true);
    setError(null);
    setVideoUrl(null);

    try {
      const payload: VideoPayload = {
        prompt,
        avatar,
        voice,
        scenes,
        style,
        duration,
        ratio,
        resolution,
        mode,
      };

      const result = await generateVideo(payload);

      if (result.video_url) {
        setVideoUrl(result.video_url);
      } else if (result.job_id) {
        setError(`Wideo w kolejce. Job ID: ${result.job_id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Nieznany błąd");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Button
        onClick={handleGenerate}
        disabled={loading}
        className="bg-primary hover:bg-primary/90"
      >
        {loading ? "Generowanie..." : "Generate Video"}
      </Button>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {videoUrl && (
        <div className="flex flex-col gap-2">
          <video src={videoUrl} controls className="w-full rounded-lg" />
          <a
            href={videoUrl}
            download
            className="text-sm text-primary underline"
          >
            Pobierz wideo
          </a>
        </div>
      )}
    </div>
  );
}
