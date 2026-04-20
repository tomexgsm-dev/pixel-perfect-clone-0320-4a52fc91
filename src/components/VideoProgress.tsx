import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Upload, Sparkles, Film, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Animowany pasek postępu dla generowania Wan 2.2 I2V.
 * Symuluje progres na bazie szacowanego czasu (~90s),
 * ze "soft capem" na 95% do momentu zakończenia requestu.
 */

type Stage = {
  id: string;
  label: string;
  threshold: number; // % przy którym etap startuje
  icon: React.ComponentType<{ className?: string }>;
};

const STAGES: Stage[] = [
  { id: "upload", label: "Wysyłanie obrazu", threshold: 0, icon: Upload },
  { id: "queue", label: "Kolejka GPU (ZeroGPU)", threshold: 8, icon: Clock },
  { id: "frames", label: "Generowanie klatek", threshold: 18, icon: Sparkles },
  { id: "encode", label: "Finalizacja wideo", threshold: 88, icon: Film },
  { id: "done", label: "Gotowe", threshold: 100, icon: CheckCircle2 },
];

interface VideoProgressProps {
  isGenerating: boolean;
  /** Szacowany całkowity czas w sekundach (default 90) */
  estimatedSeconds?: number;
  /** Maksymalny soft-cap przed zakończeniem (default 95%) */
  softCap?: number;
}

export function VideoProgress({
  isGenerating,
  estimatedSeconds = 90,
  softCap = 95,
}: VideoProgressProps) {
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (isGenerating) {
      startRef.current = performance.now();
      setProgress(0);
      setElapsed(0);

      const tick = () => {
        if (!startRef.current) return;
        const elapsedMs = performance.now() - startRef.current;
        const elapsedSec = elapsedMs / 1000;
        setElapsed(elapsedSec);

        // Easing: szybki start, wolniejsze zbliżanie do softCap
        const linear = Math.min(elapsedSec / estimatedSeconds, 1);
        const eased = 1 - Math.pow(1 - linear, 1.6); // ease-out
        setProgress(Math.min(eased * softCap, softCap));

        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    } else {
      // Po zakończeniu — szybko dociągnij do 100%
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (progress > 0) {
        setProgress(100);
        const reset = setTimeout(() => {
          setProgress(0);
          setElapsed(0);
          startRef.current = null;
        }, 1200);
        return () => clearTimeout(reset);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating]);

  const currentStage = [...STAGES].reverse().find((s) => progress >= s.threshold) ?? STAGES[0];
  const remaining = Math.max(0, estimatedSeconds - elapsed);

  return (
    <AnimatePresence>
      {(isGenerating || progress > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-border bg-card/60 p-4 space-y-3 backdrop-blur-sm"
        >
          {/* Nagłówek z aktualnym etapem */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <motion.div
                key={currentStage.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-500/15 text-violet-400 shrink-0"
              >
                <currentStage.icon className="w-4 h-4" />
              </motion.div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {currentStage.label}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Wan 2.2 I2V Lightning · ZeroGPU
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold tabular-nums text-violet-300">
                {Math.round(progress)}%
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {progress >= 100
                  ? "ukończono"
                  : `~${Math.ceil(remaining)}s pozostało`}
              </p>
            </div>
          </div>

          {/* Pasek postępu */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500"
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: 0.3 }}
            />
            {/* Animowany shimmer */}
            {isGenerating && progress < 100 && (
              <motion.div
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                animate={{ x: ["-100%", "400%"] }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            )}
          </div>

          {/* Mini-tracker etapów */}
          <div className="flex items-center justify-between gap-1 pt-1">
            {STAGES.slice(0, -1).map((s) => {
              const reached = progress >= s.threshold;
              const active = currentStage.id === s.id;
              return (
                <div
                  key={s.id}
                  className="flex flex-col items-center gap-1 flex-1 min-w-0"
                >
                  <div
                    className={cn(
                      "h-1.5 w-full rounded-full transition-colors duration-300",
                      reached
                        ? "bg-violet-500"
                        : "bg-muted-foreground/20"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10px] truncate transition-colors duration-300",
                      active
                        ? "text-violet-300 font-medium"
                        : reached
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50"
                    )}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
