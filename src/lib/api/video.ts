export async function mergeVideos(clips: string[]) {
  const endpoint = "https://fdsebtzzxsmsmaaqjdev.supabase.co/functions/v1/merge";

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
    try { err = await res.json(); }
    catch { err = await res.text(); }
    throw new Error("Merge failed: " + JSON.stringify(err));
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
