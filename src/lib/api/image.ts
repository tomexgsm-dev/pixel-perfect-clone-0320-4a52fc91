export async function generateImage(
  action: string,
  prompt?: string,
  file?: File
) {
  const baseUrl = import.meta.env.NEXUS_IMAGE_API;
  const url = `${baseUrl}/${action}`;

  let options: RequestInit;

  // Tryby tekstowe: generate, product, logo, banner, social
  if (["generate", "product", "logo", "banner", "social"].includes(action)) {
    options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: prompt || "" }),
    };
  } else {
    // Tryby obrazkowe: restore, upscale, colorize
    if (!file) {
      throw new Error("Image file is required for this action");
    }

    const formData = new FormData();
    formData.append("image", file);

    options = {
      method: "POST",
      body: formData,
    };
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const text = await response.text();
    console.error("Image API error:", response.status, text);
    throw new Error("Image generation failed");
  }

  // Backend zwraca PNG → blob → URL do <img>
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  return objectUrl;
}

