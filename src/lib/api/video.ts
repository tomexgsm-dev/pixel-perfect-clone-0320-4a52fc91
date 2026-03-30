export async function mergeVideos(clips: string[]) {
  const endpoint = "https://fdsebtzzxsmsmaaqjdev.supabase.co/functions/v1/merge";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ clips })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Merge failed: " + err);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
