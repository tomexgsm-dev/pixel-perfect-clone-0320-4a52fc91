import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Groq fallback config (free tier)
function getGroqFallback() {
  return {
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: Deno.env.get("GROQ_KEY"),
    model: "llama-3.3-70b-versatile",
    type: "openai" as const,
  };
}

// Model ID → provider config
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
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${Deno.env.get(
          "GEMINI_KEY",
        )}`,
        key: Deno.env.get("GEMINI_KEY"),
        model: "gemini-2.0-flash",
        type: "gemini" as const,
      };
    case "groq":
      return getGroqFallback();
    default:
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${Deno.env.get(
          "GEMINI_KEY",
        )}`,
        key: Deno.env.get("GEMINI_KEY"),
        model: "gemini-2.0-flash",
        type: "gemini" as const,
      };
  }
}

async function callClaude(config: any, messages: any[], systemPrompt: string) {
  const claudeMessages = messages
    .filter((m: any) => m.role !== "system")
    .map((m: any) => ({
      role: m.role === "user" ? "user" : "assistant",
      content:
        typeof m.content === "string"
          ? m.content
          : m.content.map((c: any) => {
              if (c.type === "text") return { type: "text", text: c.text };
              if (c.type === "image_url")
                return {
                  type: "image",
                  source: { type: "url", url: c.image_url.url },
                };
              return c;
            }),
    }));

  return await fetch(config.url, {
    method: "POST",
    headers: {
      "x-api-key": config.key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: claudeMessages,
      stream: true,
    }),
  });
}

async function callGemini(config: any, messages: any[], systemPrompt: string) {
  const contents = messages.map((m: any) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts:
      typeof m.content === "string"
        ? [{ text: m.content }]
        : m.content.map((c: any) => {
            if (c.type === "text") return { text: c.text };
            if (c.type === "image_url")
              return { text: `[Image: ${c.image_url.url}]` };
            return { text: "" };
          }),
  }));

  return await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
    }),
  });
}

function flattenMessages(messages: any[]) {
  return messages.map((m: any) => {
    if (Array.isArray(m.content)) {
      const text = m.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n");
      return { role: m.role, content: text || "" };
    }
    return m;
  });
}

async function callOpenAICompatible(
  config: any,
  messages: any[],
  systemPrompt: string,
  forceFlatten = false,
) {
  const msgs = forceFlatten ? flattenMessages(messages) : messages;
  return await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "system", content: systemPrompt }, ...msgs],
      stream: true,
    }),
  });
}

async function callModel(
  config: any,
  messages: any[],
  system: string,
): Promise<Response> {
  if (config.type === "claude") return callClaude(config, messages, system);
  if (config.type === "gemini") return callGemini(config, messages, system);
  return callOpenAICompatible(config, messages, system);
}

// Transform Claude SSE stream to OpenAI-compatible SSE stream
function transformClaudeStream(
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "content_block_delta" && event.delta?.text) {
              const openAIChunk = {
                choices: [{ delta: { content: event.delta.text } }],
              };
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`),
              );
            }
            if (event.type === "message_stop") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
          } catch {}
        }
      }
    },
  });
}

// Transform Gemini SSE stream to OpenAI-compatible SSE stream
function transformGeminiStream(
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            const text = event.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const openAIChunk = {
                choices: [{ delta: { content: text } }],
              };
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`),
              );
            }
          } catch {}
        }
      }
    },
  });
}

function getOutputStream(config: any, response: Response) {
  let outputBody = response.body;
  if (config.type === "claude" && response.body) {
    outputBody = transformClaudeStream(response.body);
  } else if (config.type === "gemini" && response.body) {
    outputBody = transformGeminiStream(response.body);
  }
  return outputBody;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, systemPrompt, model } = await req.json();
    const defaultSystem =
      "You are Nexus AI, an intelligent and helpful assistant. Answer clearly and concisely. Write in the user's language.";
    const system = systemPrompt || defaultSystem;
    const selectedModel = model || "gemini";

    const config = getProviderConfig(selectedModel);
    console.log("Selected model:", selectedModel, "→", config.model);

    if (!config.key) {
      const groq = getGroqFallback();
      if (groq.key) {
        console.log("⚡ No key for", selectedModel, "→ Groq fallback");
        const response = await callOpenAICompatible(
          groq,
          messages,
          system,
          true,
        );
        if (response.ok) {
          return new Response(response.body, {
            headers: {
              ...corsHeaders,
              "Content-Type": "text/event-stream",
            },
          });
        }
      }
      return new Response(
        JSON.stringify({ error: `API key not configured for ${selectedModel}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let response = await callModel(config, messages, system);

    if (!response.ok && selectedModel !== "groq") {
      const errText = await response.text();
      console.error(`❌ ${selectedModel} failed (${response.status}):`, errText);

      const groq = getGroqFallback();
      if (groq.key) {
        console.log("⚡ Falling back to Groq (llama-3.3-70b-versatile)");
        const fallbackResponse = await callOpenAICompatible(
          groq,
          messages,
          system,
          true,
        );
        if (fallbackResponse.ok) {
          return new Response(fallbackResponse.body, {
            headers: {
              ...corsHeaders,
              "Content-Type": "text-event-stream",
            },
          });
        }
      }

      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please try again later.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          error: `AI error from ${selectedModel}: ${response.status}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(
        JSON.stringify({
          error: `AI error from ${selectedModel}: ${response.status}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(getOutputStream(config, response), {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
      },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
