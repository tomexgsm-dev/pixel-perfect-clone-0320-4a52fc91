import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image1, image2, prompt, mix } = await req.json();

    if (!image1 || !image2) {
      return new Response(
        JSON.stringify({ error: "Both image1 and image2 (base64 data URIs) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mixPct = typeof mix === "number" ? Math.round(mix * 100) : 50;
    const aWeight = 100 - mixPct;
    const bWeight = mixPct;

    const userPrompt = (prompt && String(prompt).trim()) || "Blend these two images creatively";
    const fullPrompt = `${userPrompt}. Seamlessly merge Image A and Image B into one cohesive, photorealistic composition. Weight: ${aWeight}% Image A, ${bWeight}% Image B. Preserve key subjects, style and lighting from each according to the weights. High detail, natural blending, no visible seams.`;

    console.log(`Blend PRO — calling Lovable AI Gateway (mix A:${aWeight}% B:${bWeight}%)`);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: fullPrompt },
              { type: "image_url", image_url: { url: image1 } },
              { type: "image_url", image_url: { url: image2 } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("Lovable AI error:", aiRes.status, errText.slice(0, 500));
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: `Blend failed: ${aiRes.status}`, details: errText.slice(0, 300) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await aiRes.json();
    const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("No image in response:", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "No blended image returned by AI" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ image_url: imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("blend-pro error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
