import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface SpeechSettings {
  voiceURI: string;
  rate: number;
  autoRead: boolean;
  setVoiceURI: (uri: string) => void;
  setRate: (rate: number) => void;
  setAutoRead: (v: boolean) => void;
  voices: SpeechSynthesisVoice[];
}

const SpeechSettingsContext = createContext<SpeechSettings | null>(null);

const STORAGE_KEY = "speech-settings";

export function SpeechSettingsProvider({ children }: { children: ReactNode }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").voiceURI || ""; } catch { return ""; }
  });
  const [rate, setRate] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").rate || 1; } catch { return 1; }
  });
  const [autoRead, setAutoRead] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").autoRead || false; } catch { return false; }
  });

  useEffect(() => {
    const load = () => {
      const v = speechSynthesis.getVoices();
      if (v.length) setVoices(v);
    };
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ voiceURI, rate }));
  }, [voiceURI, rate]);

  return (
    <SpeechSettingsContext.Provider value={{ voiceURI, rate, setVoiceURI, setRate, voices }}>
      {children}
    </SpeechSettingsContext.Provider>
  );
}

export function useSpeechSettings() {
  const ctx = useContext(SpeechSettingsContext);
  if (!ctx) throw new Error("useSpeechSettings must be used within SpeechSettingsProvider");
  return ctx;
}
