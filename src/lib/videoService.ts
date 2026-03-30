export interface VideoPayload {
  prompt: string;
  mode?: string;
  duration?: number;
  avatar?: string;
  voice?: string;
  scenes?: { text: string; duration?: number }[];
  style?: string;
  ratio?: string;
  resolution?: string;
  image?: string;
}

export async function generateVideo(payload: VideoPayload) {
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clever-api`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Video generation failed: " + err);
  }

  return res.json();
}
