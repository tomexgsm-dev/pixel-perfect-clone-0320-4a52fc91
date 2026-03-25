export async function generateImage(prompt: string, file?: File) {
  const apiUrl = import.meta.env.NEXUS_IMAGE_API;

  const formData = new FormData();
  formData.append("prompt", prompt);

  if (file) {
    formData.append("image", file);
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    console.error("Image API error:", response.status, await response.text());
    throw new Error("Image generation failed");
  }

  const result = await response.json();

  return result.data[0].image;
}

