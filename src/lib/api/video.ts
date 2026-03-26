import { supabase } from "@/lib/supabaseClient";

// Typ rekordu wideo
export type VideoRecord = {
  id: string;
  url: string;
  prompt: string;
  style?: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
  created_at: string;
};

// Zapis wideo do galerii
export async function saveVideoToGallery(
  file: File,
  metadata: {
    prompt: string;
    style?: string;
    duration?: number;
    ratio?: string;
    resolution?: string;
  }
) {
  // 1. Upload pliku do Supabase Storage
  const filePath = `videos/${Date.now()}-${file.name}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("videos")
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const publicUrl = supabase.storage
    .from("videos")
    .getPublicUrl(filePath).data.publicUrl;

  // 2. Zapis metadanych do tabeli
  const { error: insertError } = await supabase.from("videos").insert({
    url: publicUrl,
    prompt: metadata.prompt,
    style: metadata.style,
    duration: metadata.duration,
    ratio: metadata.ratio,
    resolution: metadata.resolution,
  });

  if (insertError) throw insertError;

  return publicUrl;
}

// Pobieranie galerii
export async function getVideoGallery(): Promise<VideoRecord[]> {
  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data as VideoRecord[];
}

// Usuwanie wideo
export async function deleteVideo(id: string, url: string) {
  // 1. Usuń rekord z tabeli
  const { error: deleteError } = await supabase
    .from("videos")
    .delete()
    .eq("id", id);

  if (deleteError) throw deleteError;

  // 2. Usuń plik ze storage
  const path = url.split("/").slice(-1)[0]; // nazwa pliku
  await supabase.storage.from("videos").remove([`videos/${path}`]);
}
