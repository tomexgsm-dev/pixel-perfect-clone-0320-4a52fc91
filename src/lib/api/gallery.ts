import { supabase } from "@/lib/supabase";

export async function saveImageToGallery(file: File, prompt: string) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `${fileName}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from("generated-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from("generated-images")
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData.publicUrl;

  // Save DB record
  const { error: dbError } = await supabase.from("images").insert({
    url: publicUrl,
    prompt,
  });

  if (dbError) throw dbError;

  return publicUrl;
}

export async function getGallery() {
  const { data, error } = await supabase
    .from("images")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function deleteImage(id: string, url: string) {
  // Extract filename from URL
  const fileName = url.split("/").pop();

  if (fileName) {
    await supabase.storage
      .from("generated-images")
      .remove([fileName]);
  }

  await supabase.from("images").delete().eq("id", id);
}
