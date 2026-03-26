import { supabase } from "@/lib/supabase";

export async function saveVideoToGallery(
  file: File,
  options: {
    prompt: string;
    style?: string;
    duration?: number;
    ratio?: string;
    resolution?: string;
  }
) {
  const fileExt = file.name.split(".").pop() || "mp4";
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `${fileName}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("generated-videos")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from("generated-videos")
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData.publicUrl;

  // Save DB record
  const { error: dbError } = await supabase.from("videos").insert({
    url: publicUrl,
    prompt: options.prompt,
    style: options.style,
    duration: options.duration,
    ratio: options.ratio,
    resolution: options.resolution,
  });

  if (dbError) throw dbError;

  return publicUrl;
}

export async function getVideoGallery() {
  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function deleteVideo(id: string, url: string) {
  const fileName = url.split("/").pop();

  if (fileName) {
    await supabase.storage
      .from("generated-videos")
      .remove([fileName]);
  }

  await supabase.from("videos").delete().eq("id", id);
}
