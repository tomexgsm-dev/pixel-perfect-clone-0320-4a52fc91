import { useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceInputProps {
  onText: (text: string) => void;
  onSubmit?: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onText, onSubmit, disabled }: VoiceInputProps) {
  const [listening, setListening] = useState(false);

  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Twoja przeglądarka nie obsługuje mikrofonu 😢");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pl-PL";
    recognition.interimResults = false;
    recognition.start();
    setListening(true);

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      onText(text);
      setListening(false);
      if (onSubmit) onSubmit(text);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
  };

  return (
    <button
      type="button"
      onClick={startListening}
      disabled={disabled || listening}
      className={cn(
        "p-2.5 rounded-xl transition-all",
        listening
          ? "bg-destructive text-destructive-foreground animate-pulse"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
      title={listening ? "Słucham..." : "Mów do AI"}
    >
      {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>
  );
}
