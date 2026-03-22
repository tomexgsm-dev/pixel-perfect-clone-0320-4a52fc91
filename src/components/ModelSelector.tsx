import { useState } from "react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export const AI_MODELS = [
  { id: "gemini", name: "Gemini", icon: "🔴", color: "text-red-400" },
  { id: "deepseek", name: "DeepSeek", icon: "🟢", color: "text-green-400" },
  { id: "mistral", name: "Mistral", icon: "🔵", color: "text-blue-400" },
  { id: "claude", name: "Claude", icon: "🟣", color: "text-purple-400" },
  { id: "llama", name: "Llama", icon: "🟠", color: "text-orange-400" },
  { id: "groq", name: "Groq", icon: "⚡", color: "text-yellow-400" },
] as const;

export type AIModelId = typeof AI_MODELS[number]["id"];

interface ModelSelectorProps {
  value: AIModelId;
  onChange: (model: AIModelId) => void;
  disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const current = AI_MODELS.find((m) => m.id === value) || AI_MODELS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all border border-border bg-card hover:bg-accent disabled:opacity-50",
        )}
        title={t.chat.selectModel}
      >
        <span>{current.icon}</span>
        <span className="hidden sm:inline">{current.name}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1 z-50 bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[140px]">
            {AI_MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => { onChange(model.id); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left",
                  model.id === value && "bg-accent/50 font-medium"
                )}
              >
                <span>{model.icon}</span>
                <span>{model.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
