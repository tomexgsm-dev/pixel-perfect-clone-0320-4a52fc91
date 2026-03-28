import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// ================= CONFIG =================

function getGroqFallback() {
  return {
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: Deno.env.get("GROQ_KEY"),
    model: "llama-3.3-70b-versatile",
    type: "openai" as const,
  };
}

function getProviderConfig(model: string) {
  switch (model) {
    case "deepseek":
      return {
        url: "https://api.deepseek.com/v1/chat/completions",
        key: Deno.env.get("DEEPSEEK_KEY"),
        model: "deepseek-chat",
        type: "openai" as const,
      };
    case "mistral":
      return {
        url: "https://router.huggingface.co/hf-inference/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions",
        key: Deno.env.get("HF_KEY"),
        model: "mistralai/Mistral-7B-Instruct-v0.3",
        type: "openai" as const,
      };
    case "claude":
      return {
        url: "https://api.anthropic.com/v1/messages",
        key: Deno.env.get("CLAUDE_KEY"),
        model: "claude-3-sonnet-20240229",
        type: "claude" as const,
      };
    case "llama":
      return {
        url: "https://api.together.xyz/v1/chat/completions",
        key: Deno.env.get("TOGETHER_KEY"),
        model: "meta-llama/Llama-3-70b-chat-hf",
        type: "openai" as const,
      };
    case "gemini":
    default:
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${Deno.env.get("GEMINI_KEY")}`,
        key: Deno.env.get("GEMINI_KEY"),
        model: "gemini-2.0-flash",
        type: "gemini" as const,
      };
  }
}

// ================= CALLS =================

async function callClaude(config: any, messages: any[], system: string) {
  return fetch(config.url, {
    method: "POST",
    headers: {
      "x-api-key": config.key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      system,
      messages,
      stream: true,
    }),
  });
}

async function callGemini(config: any, messages: any[], system: string) {
  return fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    }),
  });
}

async function callOpenAICompatible(config: any, messages: any[], system: string) {
  return fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "system", content: system }, ...messages],
      stream: true,
    }),
  });
}

async function callModel(config: any, messages: any[], system: string) {
  if (config.type === "claude") return callClaude(config, messages, system);
  if (config.type === "gemini") return callGemini(config, messages, system);
  return callOpenAICompatible(config, messages, system);
}

// ================= MAIN =================

serve(async (req) => {
  // ✅ CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const messages = body.messages || [];
    const system =
      body.systemPrompt ||
      "You are a helpful assistant. Answer clearly.";
    const model = body.model || "gemini";

    const config = getProviderConfig(model);

    if (!config.key) {
      return new Response(
        JSON.stringify({ error: "Missing API key" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let response = await callModel(config, messages, system);

    if (!response.ok) {
      const text = await response.text();
      console.error("AI error:", text);

      return new Response(
        JSON.stringify({ error: "AI request failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
      },
    });
  } catch (err) {
    console.error("ERROR:", err);

    return new Response(
      JSON.stringify({ error: "Server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
