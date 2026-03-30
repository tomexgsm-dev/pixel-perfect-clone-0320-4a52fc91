import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ================= LOSOWANIE MODELU =================

const RANDOM_MODELS = [
  { name: "mistral", enabled: true },
  { name: "claude", enabled: true },
  { name: "llama", enabled: true },
  { name: "deepseek", enabled: false }, // wyłączony - brak DEEPSEEK_KEY w Secrets
];

function pickRandomModel(): string {
  const active = RANDOM_MODELS.filter((m) => m.enabled);
  return active[Math.floor(Math.random() * active.length)].name;
}

// ================= PROVIDER CONFIG =================

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
        url: "https://ai.gateway.lovable.dev/v1/chat/completions",
        key: Deno.env.get("LOVABLE_API_KEY"),
        model: "google/gemini-3-flash-preview",
        type: "openai" as const,
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
  return callOpenAICompatible(config, messages, system);
}

// ================= MAIN =================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = Array.isArray(body.messages) ? body.messages : [{ role: "user", content: body.prompt || "Hello" }];

    const system = body.systemPrompt || "You are a helpful assistant. Answer clearly.";

    const requestedModel = body.model || "random";
    const model = requestedModel === "random" ? pickRandomModel() : requestedModel;

    console.log(`[AI Router] Model wybrany: ${model} (żądany: ${requestedModel})`);

    const config = getProviderConfig(model);

    if (!config.key) {
      return new Response(JSON.stringify({ error: "Missing API key for selected model" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await callModel(config, messages, system);

    if (!response.ok) {
      const text = await response.text();
      console.error("AI error:", response.status, text);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-AI-Model-Used": model,
      },
    });
  } catch (err) {
    console.error("ERROR:", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
