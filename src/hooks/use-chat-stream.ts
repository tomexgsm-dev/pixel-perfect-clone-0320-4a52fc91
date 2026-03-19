import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  rating?: number | null;
}

export function useChatStream(conversationId: string | undefined) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string, messages: Message[], systemPrompt?: string | null): Promise<boolean> => {
    if (!conversationId) return false;

    setIsStreaming(true);
    setStreamingMessage("");
    setStreamError(null);

    try {
      // Save user message to DB
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content,
      });

      // Build message history for AI
      const aiMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      aiMessages.push({ role: "user", content });

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: aiMessages, systemPrompt }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setStreamError(err.error || "Failed to get response");
        setIsStreaming(false);
        return false;
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullResponse += delta;
              setStreamingMessage(fullResponse);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save assistant response to DB
      if (fullResponse) {
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: fullResponse,
        });
      }

      setStreamingMessage("");
      return true;
    } catch (err) {
      console.error("Stream error:", err);
      setStreamError("Connection error");
      return false;
    } finally {
      setIsStreaming(false);
    }
  }, [conversationId]);

  return { sendMessage, isStreaming, streamingMessage, streamError, clearError: () => setStreamError(null) };
}
