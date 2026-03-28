import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 🔥 HUGGINGFACE API
const HF_API = "https://webnowa-nexus-video-api.hf.space";

// 🔥 fallback video (jak API padnie)
const FALLBACK_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

serve(async (req) => {
  // ✅ CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const {
      prompt,
      avatar,
      voice,
      template,
      scenes,
      mode,
      image,
      avatarImage,
    } = body;

    // =========================
    // 🧠 SCENES → SCRIPT
    // =========================
    let finalPrompt = prompt || "";

    if (Array.isArray(scenes) && scenes.length > 0) {
      finalPrompt = scenes
        .map((s: any) => s.text)
        .filter(Boolean)
        .join(" ");
    }

    // =========================
    // 🎬 TEMPLATE BOOST
    // =========================
    if (template === "ad") {
      finalPrompt = `High converting advertisement video: ${finalPrompt}`;
    }

    if (template === "tiktok") {
      finalPrompt = `Viral TikTok style video: ${finalPrompt}`;
    }

    if (template === "story") {
      finalPrompt = `Cinematic storytelling video: ${finalPrompt}`;
    }

    console.log("🔥 FINAL PROMPT:", finalPrompt);

    // =========================
    // 🚀 CALL HUGGINGFACE
    // =========================
    let videoUrl: string | null = null;

    try {
      const hfRes = await fetch(`${HF_API}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          avatar,
          voice,
          mode,
          image,
          avatarImage,
        }),
      });

      if (hfRes.ok) {
        const data = await hfRes.json();
        videoUrl = data?.video_url || null;
      } else {
        const err = await hfRes.text();
        console.error("HF ERROR:", err);
      }
    } catch (e) {
      console.error("HF FETCH ERROR:", e);
    }

    // =========================
    // 🔥 FALLBACK (ZAWSZE DZIAŁA)
    // =========================
    if (!videoUrl) {
      console.log("⚡ Using fallback video");
      videoUrl = FALLBACK_VIDEO;
    }

    // =========================
    // ✅ RESPONSE
    // =========================
    return new Response(
      JSON.stringify({
        video_url: videoUrl,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("❌ SERVER ERROR:", err);

    return new Response(
      JSON.stringify({
        video_url: FALLBACK_VIDEO,
        error: "Server fallback",
      }),
      {
        status: 200, // 🔥 NIE 500 żeby frontend nie wybuchł
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
