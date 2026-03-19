import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { pl } from "./locales/pl";
import { en } from "./locales/en";

export type Lang = "pl" | "en";

const LOCALES: Record<Lang, typeof en> = { pl, en };
const STORAGE_KEY = "nexus-lang";

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored && LOCALES[stored]) return stored;
  } catch { /* ignore */ }
  return "en";
}

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: typeof en;
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: en,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);
  const t = LOCALES[lang];

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    try { localStorage.setItem(STORAGE_KEY, newLang); } catch { /* ignore */ }
  };

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
