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
    const { prompt } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const seed = (prompt && String(prompt).trim()) || "creative image prompts";

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are a creative AI image-prompt generator. Always return EXACTLY 3 highly-detailed image prompts. Each prompt should be vivid, cinematic, photorealistic, with style, lighting, lens and quality cues. Return them via the suggest_prompts tool.",
          },
          {
            role: "user",
            content: `Generate 3 image prompts inspired by: "${seed}".`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_prompts",
              description: "Return exactly 3 image generation prompts.",
              parameters: {
                type: "object",
                properties: {
                  prompts: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 3,
                    maxItems: 3,
                  },
                },
                required: ["prompts"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_prompts" } },
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("Lovable AI error:", aiRes.status, t.slice(0, 400));
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: `AI gateway error: ${aiRes.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await aiRes.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    let prompts: string[] = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        if (Array.isArray(parsed?.prompts)) prompts = parsed.prompts;
      } catch (e) {
        console.error("Failed to parse tool args:", e);
      }
    }

    // Fallback: try to parse plain content lines
    if (prompts.length === 0) {
      const content = data?.choices?.[0]?.message?.content || "";
      prompts = String(content)
        .split("\n")
        .map((l: string) => l.replace(/^[\d\.\-\*\)\s]+/, "").trim())
        .filter((l: string) => l.length > 10)
        .slice(0, 3);
    }

    if (prompts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No prompts generated" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ prompts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("prompt-ai error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
