import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { ChatMessage } from "@/components/ChatMessage";
import { useChatStream, type Message } from "@/hooks/use-chat-stream";
import { Send, Loader2, Paperclip, X, Image, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function ChatPage() {
  const { id: conversationId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const { data: conversation } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!conversationId,
  });

  const { data: dbMessages, isLoading } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!conversationId,
  });

  const messages: Message[] = (dbMessages || []).map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    rating: m.rating,
    attachment_url: (m as any).attachment_url || null,
    attachment_type: (m as any).attachment_type || null,
    attachment_name: (m as any).attachment_name || null,
  }));

  const { sendMessage, isStreaming, streamingMessage, streamError } = useChatStream(conversationId);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => { scrollToBottom(); }, [dbMessages, streamingMessage]);

  const handleRate = useCallback(async (messageId: string, rating: 1 | -1 | null) => {
    await supabase.from("messages").update({ rating }).eq("id", messageId);
    queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
  }, [conversationId, queryClient]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > MAX_FILE_SIZE) {
      alert(t.chat.attachmentTooLarge);
      return;
    }

    setAttachment(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setAttachmentPreview(url);
    } else {
      setAttachmentPreview(null);
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
      setAttachmentPreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadFile = async (file: File): Promise<{ url: string; type: string; name: string } | null> => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
    
    const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    
    const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
    return { url: urlData.publicUrl, type: file.type, name: file.name };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachment) || isStreaming || !conversationId) return;

    const content = input.trim();
    const currentAttachment = attachment;
    setInput("");
    removeAttachment();
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    let attachmentData: { url: string; type: string; name: string } | null = null;
    
    if (currentAttachment) {
      setUploading(true);
      attachmentData = await uploadFile(currentAttachment);
      setUploading(false);
    }

    const ok = await sendMessage(content || "📎 " + (attachmentData?.name || "attachment"), messages, conversation?.system_prompt, attachmentData);
    if (ok) {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  return (
    <Layout>
      {isLoading ? (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col h-full absolute inset-0">
          <div className="flex-1 overflow-y-auto pb-32">
            {messages.length === 0 && !streamingMessage && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-6 shadow-lg border border-border">
                  <div className="w-8 h-8 bg-primary rounded-full shadow-glow animate-pulse" />
                </div>
                <h2 className="text-2xl font-display font-bold mb-2">{conversation?.title || t.chat.emptyTitle}</h2>
                <p className="text-muted-foreground">
                  {conversation?.app_id ? t.chat.appEmptySubtitle : t.chat.emptySubtitle}
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className="group">
                <ChatMessage message={msg} onRate={handleRate} />
              </div>
            ))}

            {(isStreaming || streamingMessage) && (
              <div className="group">
                <ChatMessage
                  message={{ id: "streaming", role: "assistant", content: streamingMessage }}
                  isStreaming={true}
                />
              </div>
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>

          {/* Input */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-4 px-4 md:px-8">
            <div className="max-w-3xl mx-auto relative">
              {streamError && (
                <div className="mb-2 px-4 py-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl">
                  {streamError}
                </div>
              )}

              {/* Attachment Preview */}
              {attachment && (
                <div className="mb-2 flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
                  {attachmentPreview ? (
                    <img src={attachmentPreview} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attachment.name}</p>
                    <p className="text-xs text-muted-foreground">{(attachment.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={removeAttachment} className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title={t.chat.removeAttachment}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.txt,.md,.csv,.json,.doc,.docx"
                  onChange={handleFileSelect}
                />
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(e); }}
                  onKeyDown={handleKeyDown}
                  placeholder={t.chat.placeholder}
                  rows={1}
                  className="w-full resize-none bg-card border border-border rounded-2xl pl-12 pr-14 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-lg"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming || uploading}
                  className="absolute left-2 bottom-2 p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title={t.chat.attach}
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  disabled={(!input.trim() && !attachment) || isStreaming || uploading}
                  className={cn(
                    "absolute right-2 bottom-2 p-2.5 rounded-xl transition-all",
                    (input.trim() || attachment) && !isStreaming && !uploading
                      ? "bg-primary text-primary-foreground shadow-glow hover:scale-105"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {isStreaming || uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>

              <p className="text-center text-xs text-muted-foreground/50 mt-2">
                {t.chat.disclaimer}
              </p>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
