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
  const baseUrl = import.meta.env.VITE_NEXUS_IMAGE_API;

  const res = await fetch(`${baseUrl}/prompt-ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) throw new Error("Prompt AI error");

  return await res.json();
}

/* ============================================================
   BLEND PRO — /blend-pro
============================================================ */

export async function blendPro(
  image1: File,
  image2: File,
  prompt: string,
  mix: number = 0.5
) {
  const baseUrl = import.meta.env.VITE_NEXUS_IMAGE_API;

  const form = new FormData();
  form.append("image1", image1);
  form.append("image2", image2);
  form.append("prompt", prompt);
  form.append("mix", mix.toString());

  const res = await fetch(`${baseUrl}/blend-pro`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Blend PRO error:", res.status, text);
    throw new Error("Blend PRO failed");
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
