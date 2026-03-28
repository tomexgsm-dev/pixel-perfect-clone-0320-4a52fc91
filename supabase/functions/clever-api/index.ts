import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 🔥 FAKE VIDEO (fallback jak API nie masz jeszcze)
const DEMO_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

serve(async (req) => {
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

    console.log("🔥 REQUEST:", {
      prompt,
      avatar,
      voice,
      template,
      scenes,
      mode,
    });

    // =========================
    // 🧠 SCENES → SCRIPT
    // =========================
    let finalScript = prompt || "";

    if (Array.isArray(scenes) && scenes.length > 0) {
      finalScript = scenes.map((s: any) => s.text).join(" ");
    }

    // =========================
    // 🎬 TEMPLATE BOOST
    // =========================
    if (template === "ad") {
      finalScript = `Create high converting ad: ${finalScript}`;
    }
    if (template === "tiktok") {
      finalScript = `Create viral TikTok: ${finalScript}`;
    }
    if (template === "story") {
      finalScript = `Create cinematic story: ${finalScript}`;
    }

    // =========================
    // 👤 AVATAR + VOICE INFO
    // =========================
    const meta = {
      avatar,
      voice,
      mode,
      hasImage: !!image,
      hasAvatarImage: !!avatarImage,
    };

    console.log("🎭 META:", meta);

    // =========================
    // 🚀 TU PODŁĄCZYSZ PRAWDZIWE API
    // =========================
    // np:
    // Runway / Pika / HeyGen / Stability

    // 🔥 NA RAZIE: ZWRACAMY DEMO VIDEO (żeby działało)
    return new Response(
      JSON.stringify({
        video_url: DEMO_VIDEO,
        debug: {
          script: finalScript,
          meta,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("❌ ERROR:", err);

    return new Response(
      JSON.stringify({
        error: "Server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
