import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, Copy, Check, ThumbsUp, ThumbsDown, FileText, Download } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import type { Message } from "@/hooks/use-chat-stream";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  onRate?: (messageId: string, rating: 1 | -1 | null) => void;
}

export function ChatMessage({ message, isStreaming, onRate }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRate = (value: 1 | -1) => {
    if (!onRate || !message.id) return;
    const newRating = message.rating === value ? null : value;
    onRate(message.id, newRating);
  };

  const isImage = message.attachment_type?.startsWith("image/");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "py-6 px-4 md:px-8 flex gap-4 md:gap-6 w-full justify-center border-b border-border/40",
        isUser ? "bg-background" : "bg-card/40"
      )}
    >
      <div className="max-w-3xl w-full flex gap-4 md:gap-6">
        <div className="shrink-0 mt-1">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center border border-border shadow-sm">
              <User className="w-4 h-4 text-secondary-foreground" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-glow">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="font-semibold text-sm text-muted-foreground mb-1">
            {isUser ? t.chat.you : t.chat.assistant}
          </div>

          {/* Attachment display */}
          {message.attachment_url && (
            <div className="mb-2">
              {isImage ? (
                <a href={message.attachment_url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={message.attachment_url}
                    alt={message.attachment_name || "attachment"}
                    className="max-w-xs max-h-64 rounded-xl border border-border object-cover hover:opacity-90 transition-opacity cursor-pointer"
                  />
                </a>
              ) : (
                <a
                  href={message.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm hover:bg-secondary transition-colors"
                >
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="truncate max-w-[200px]">{message.attachment_name || "File"}</span>
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                </a>
              )}
            </div>
          )}

          <div className={cn(
            "prose",
            isStreaming && !isUser && "after:content-[''] after:inline-block after:w-1.5 after:h-4 after:bg-primary after:ml-1 after:animate-pulse"
          )}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content || (isStreaming ? "" : "...")}
            </ReactMarkdown>
          </div>

          {!isUser && !isStreaming && message.content && (
            <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={handleCopy} title={t.chat.copy} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              {onRate && message.id && (
                <>
                  <button onClick={() => handleRate(1)} className={cn("p-1.5 rounded-lg transition-colors", message.rating === 1 ? "text-green-400 bg-green-400/10" : "text-muted-foreground hover:text-green-400 hover:bg-green-400/10")}>
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleRate(-1)} className={cn("p-1.5 rounded-lg transition-colors", message.rating === -1 ? "text-red-400 bg-red-400/10" : "text-muted-foreground hover:text-red-400 hover:bg-red-400/10")}>
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
