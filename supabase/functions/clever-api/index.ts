import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  // 🔥 CORS (NAPRAWIA BŁĘDY W PRZEGLĄDARCE)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body = await req.json();

    const {
      prompt,
      style,
      duration,
      ratio,
      resolution,
      mode,
      image,
      avatar,
      voice,
      scenes,
    } = body;

    // 🔥 jeśli masz sceny → łączymy w prompt
    const finalPrompt =
      Array.isArray(scenes) && scenes.length > 0
        ? scenes.join(". ")
        : prompt;

    // 🔥 CALL DO TWOJEGO API (HuggingFace)
    const hfResponse = await fetch(
      "https://huggingface.co/spaces/webnowa/nexus-video-api/run",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          style,
          duration,
          ratio,
          resolution,
          mode,

          // nowe opcje
          avatar: avatar || null,
          voice: voice || "default",
          image: image || null,
        }),
      }
    );

    const result = await hfResponse.json();

    console.log("HF RESPONSE:", result);

    // 🔥 wyciągamy video URL z różnych formatów API
    const videoUrl =
      result?.video_url ||
      result?.url ||
      result?.data?.video ||
      result?.data?.url ||
      null;

    if (!videoUrl) {
      return new Response(
        JSON.stringify({
          error: "Brak video_url z API",
          raw: result,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ video_url: videoUrl }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    console.error("SERVER ERROR:", err);

    return new Response(
      JSON.stringify({
        error: err.message || "Server error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
