/* ============================================================
   NEXUS IMAGE PRO — API CLIENT (FULL PRO VERSION)
   Obsługuje:
   - generate / product / logo / banner / social
   - restore / upscale / colorize
   - AI Prompt Assistant (prompt-ai)
   - Blend PRO (blend-pro)
============================================================ */

export async function generateImage(
  action: string,
  prompt?: string,
  file?: File
) {
  const baseUrl = import.meta.env.VITE_NEXUS_IMAGE_API;
  const url = `${baseUrl}/${action}`;

  let options: RequestInit;

  // Tryby tekstowe
  if (["generate", "product", "logo", "banner", "social"].includes(action)) {
    options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: prompt || "" }),
    };
  }

  // Tryby obrazkowe
  else if (["restore", "upscale", "colorize"].includes(action)) {
    if (!file) throw new Error("Image file is required for this action");

    const formData = new FormData();
    formData.append("image", file);

    options = {
      method: "POST",
      body: formData,
    };
  }

  // Blend PRO — obsługiwany osobno
  else {
    throw new Error("Unsupported action");
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const text = await response.text();
    console.error("Image API error:", response.status, text);
    throw new Error("Image generation failed");
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/* ============================================================
   AI PROMPT ASSISTANT — /prompt-ai
============================================================ */

export async function promptAI(prompt: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const res = await fetch(`${supabaseUrl}/functions/v1/prompt-ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Prompt AI error:", res.status, text);
    throw new Error("Prompt AI error");
  }

  return await res.json();
}

/* ============================================================
   BLEND PRO — Supabase Edge Function (Lovable AI / Gemini Flash Image)
============================================================ */

async function fileToDataUri(file: File): Promise<string> {
  // Resize to max 1024px and convert to JPEG to keep payload small and strip metadata
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function blendPro(
  image1: File,
  image2: File,
  prompt: string,
  mix: number = 0.5
) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const [img1, img2] = await Promise.all([
    fileToDataUri(image1),
    fileToDataUri(image2),
  ]);

  const res = await fetch(`${supabaseUrl}/functions/v1/blend-pro`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ image1: img1, image2: img2, prompt, mix }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Blend PRO error:", res.status, text);
    let msg = "Blend PRO failed";
    try {
      const j = JSON.parse(text);
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }

  const data = await res.json();
  if (!data?.image_url) throw new Error("No image returned");
  return data.image_url as string;
}
