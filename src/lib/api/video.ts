// src/lib/mergeVideos.ts

export async function mergeVideos(clips: string[]) {
  if (!Array.isArray(clips) || clips.length === 0) {
    throw new Error("No clips provided for merge");
  }

  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merge`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ clips })
  });

  if (!res.ok) {
    let err;
    try {
      err = await res.json();
    } catch {
      err = await res.text();
    }
    throw new Error("Merge failed: " + JSON.stringify(err));
  }

  // Supabase Edge Function zwraca binarny plik MP4
  const blob = await res.blob();

  // Tworzymy lokalny URL do odtworzenia wideo
  return URL.createObjectURL(blob);
}
