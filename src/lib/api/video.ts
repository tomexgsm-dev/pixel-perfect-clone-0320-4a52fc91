// src/lib/api/video.ts

// Zapis wideo do galerii (Supabase Storage)
export async function saveVideoToGallery(
  file: File,
  metadata: Record<string, unknown>
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("metadata", JSON.stringify(metadata));

  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-video`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
    },
    body: formData
  });

  if (!res.ok) {
    let err;
    try {
      err = await res.json();
    } catch {
      err = await res.text();
    }
    throw new Error("Failed to save video: " + JSON.stringify(err));
  }

  return res.json();
}

// Pobieranie listy wideo z galerii (placeholder — wymagany przez build)
export async function getVideoGallery() {
  return [];
}

// Usuwanie wideo (placeholder — wymagany przez build)
export async function deleteVideo(id: string) {
  console.warn("deleteVideo() placeholder called with id:", id);
  return { success: true };
}
