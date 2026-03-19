import { useState, useCallback } from "react";

const STORAGE_KEY = "nexus-free-limits";

interface FreeLimits {
  chat: number;
  images: number;
}

const DEFAULT_LIMITS: FreeLimits = { chat: 20, images: 5 };

function getLimits(): FreeLimits {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { ...DEFAULT_LIMITS };
}

function saveLimits(limits: FreeLimits) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limits));
  } catch {}
}

export function useFreeLimits() {
  const [limits, setLimits] = useState<FreeLimits>(getLimits);

  const decrementChat = useCallback(() => {
    setLimits(prev => {
      const next = { ...prev, chat: Math.max(0, prev.chat - 1) };
      saveLimits(next);
      return next;
    });
  }, []);

  const decrementImages = useCallback(() => {
    setLimits(prev => {
      const next = { ...prev, images: Math.max(0, prev.images - 1) };
      saveLimits(next);
      return next;
    });
  }, []);

  return {
    chatLeft: limits.chat,
    imagesLeft: limits.images,
    canChat: limits.chat > 0,
    canGenerateImage: limits.images > 0,
    decrementChat,
    decrementImages,
    maxChat: DEFAULT_LIMITS.chat,
    maxImages: DEFAULT_LIMITS.images,
  };
}
