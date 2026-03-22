import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  rating?: number | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
}

interface AttachmentData {
  url: string;
  type: string;
  name: string;
}

export function useChatStream(conversationId: string | undefined) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);

  const sendMessage = useCallback(async (
    content: string,
    messages: Message[],
    systemPrompt?: string | null,
    attachment?: AttachmentData | null,
    model?: string
  ): Promise<boolean> => {
    if (!conversationId) return false;

    setIsStreaming(true);
    setStreamingMessage("");
    setStreamError(null);

    try {
      // Save user message to DB
      const insertData: any = {
        conversation_id: conversationId,
        role: "user",
        content,
      };
      if (attachment) {
        insertData.attachment_url = attachment.url;
        insertData.attachment_type = attachment.type;
        insertData.attachment_name = attachment.name;
      }
      await supabase.from("messages").insert(insertData);

      // Build message history for AI
      const aiMessages: any[] = messages.map((m) => {
        if (m.attachment_url && m.attachment_type?.startsWith("image/")) {
          return {
            role: m.role,
            content: [
              { type: "text", text: m.content },
              { type: "image_url", image_url: { url: m.attachment_url } },
            ],
          };
        }
        return { role: m.role, content: m.content };
      });

      // Add current message
      if (attachment && attachment.type.startsWith("image/")) {
        aiMessages.push({
          role: "user",
          content: [
            { type: "text", text: content },
            { type: "image_url", image_url: { url: attachment.url } },
          ],
        });
      } else {
        aiMessages.push({ role: "user", content });
      }

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
