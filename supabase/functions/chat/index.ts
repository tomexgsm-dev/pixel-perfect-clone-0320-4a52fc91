import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ================= MISTRAL CONFIG =================

const MISTRAL_URL =
  "https://router.huggingface.co/hf-inference/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions";

const HF_KEY = Deno.env.get("HF_KEY");

// ================= MAIN =================

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse JSON
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate key
    if (!HF_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing HF_KEY in environment variables" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prepare messages
    const messages = Array.isArray(body.messages)
      ? body.messages
      : [{ role: "user", content: body.prompt || "Hello" }];

    const system =
      body.systemPrompt ||
      "You are a helpful assistant. Answer clearly and concisely.";

    // Call Mistral
    const response = await fetch(MISTRAL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistralai/Mistral-7B-Instruct-v0.3",
        messages: [{ role: "system", content: system }, ...messages],
        stream: true,
      }),
    });

    // Handle errors
    if (!response.ok) {
      const text = await response.text();
      console.error("Mistral error:", response.status, text);

      return new Response(
        JSON.stringify({
          error: "Mistral request failed",
          status: response.status,
          details: text,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Stream response
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-AI-Model-Used": "mistral",
      },
    });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return new Response(
      JSON.stringify({ error: "Server error", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
