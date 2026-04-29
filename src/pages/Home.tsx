import { Layout } from "@/components/Layout";
import { Sparkles, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

declare global {
  interface Window {
    kofiwidget2?: any;
  }
}

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { user } = useAuth();

  useEffect(() => {
    const container = document.getElementById("kofi-widget-container");
    if (!container) return;

    const renderWidget = () => {
      if (window.kofiwidget2 && container) {
        container.innerHTML = "";
        window.kofiwidget2.init("Support me on Ko-fi", "#72a4f2", "U7U01YMC7Z");
        const html = window.kofiwidget2.getHTML();
        container.innerHTML = html;
      }
    };

    if (window.kofiwidget2) {
      renderWidget();
    } else {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://storage.ko-fi.com/cdn/widget/Widget_2.js"]'
      );
      if (existing) {
        existing.addEventListener("load", renderWidget);
      } else {
        const script = document.createElement("script");
        script.src = "https://storage.ko-fi.com/cdn/widget/Widget_2.js";
        script.async = true;
        script.onload = renderWidget;
        document.body.appendChild(script);
      }
    }
  }, []);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ title: "New Chat", user_id: user?.id || null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate(`/c/${data.id}`);
    },
  });

  return (
    <Layout>
      <div className="w-full h-full flex flex-col items-center justify-center p-6">
        <div className="max-w-lg w-full text-center space-y-8">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-card border border-border shadow-2xl flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
            <Sparkles className="w-10 h-10 text-primary drop-shadow-lg" />
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground">
              {t.home.welcome}
            </h1>
            <p className="text-lg text-muted-foreground/80 leading-relaxed max-w-md mx-auto">
              {t.home.subtitle}
            </p>
          </div>

          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-semibold text-lg overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] shadow-glow disabled:opacity-70"
          >
            <div className="absolute inset-0 bg-foreground/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            {createMutation.isPending ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {t.home.starting}
              </span>
            ) : (
              <span className="flex items-center gap-2 relative z-10">
                {t.home.startBtn}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </button>

          <div id="kofi-widget-container" className="flex justify-center pt-4" />
        </div>
      </div>
    </Layout>
  );
}
