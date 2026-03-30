import { supabase } from "@/lib/supabase";

export interface VideoPayload {
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

export interface VideoResult {
  video_url?: string;
  job_id?: string;
  error?: string;
}

export async function generateVideo(payload: VideoPayload): Promise<VideoResult> {
  const { data, error } = await supabase.functions.invoke("video-pro", {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || "Video generation failed");
  }

  return data as VideoResult;
}
