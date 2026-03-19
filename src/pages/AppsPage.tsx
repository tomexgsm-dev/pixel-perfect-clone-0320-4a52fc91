import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useI18n } from "@/i18n";

interface AppDef {
  id: string;
  emoji: string;
  color: string;
  category: "featured" | "productivity" | "creative" | "knowledge";
}

const APP_DEFS: AppDef[] = [
  { id: "writer", emoji: "✍️", color: "from-violet-500/20 to-purple-600/20 border-violet-500/30", category: "featured" },
  { id: "coder", emoji: "💻", color: "from-blue-500/20 to-cyan-600/20 border-blue-500/30", category: "featured" },
  { id: "translator", emoji: "🌍", color: "from-green-500/20 to-emerald-600/20 border-green-500/30", category: "featured" },
  { id: "analyst", emoji: "📊", color: "from-orange-500/20 to-amber-600/20 border-orange-500/30", category: "featured" },
  { id: "marketing", emoji: "📣", color: "from-pink-500/20 to-rose-600/20 border-pink-500/30", category: "productivity" },
  { id: "email", emoji: "📧", color: "from-sky-500/20 to-blue-600/20 border-sky-500/30", category: "productivity" },
  { id: "brainstorm", emoji: "💡", color: "from-yellow-500/20 to-orange-600/20 border-yellow-500/30", category: "creative" },
  { id: "diet", emoji: "🥗", color: "from-lime-500/20 to-green-600/20 border-lime-500/30", category: "knowledge" },
  { id: "travel", emoji: "✈️", color: "from-indigo-500/20 to-blue-600/20 border-indigo-500/30", category: "knowledge" },
  { id: "fitness", emoji: "💪", color: "from-red-500/20 to-rose-600/20 border-red-500/30", category: "knowledge" },
];

export default function AppsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const createMutation = useMutation({
    mutationFn: async (app: AppDef) => {
      const item = t.apps.items[app.id as keyof typeof t.apps.items];
      const { data, error } = await supabase
        .from("conversations")
        .insert({ title: item.name, app_id: app.id, system_prompt: item.systemPrompt })
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

  const CATEGORIES = [
    { id: "all", label: t.apps.categories.all },
    { id: "featured", label: t.apps.categories.featured },
    { id: "productivity", label: t.apps.categories.productivity },
    { id: "creative", label: t.apps.categories.creative },
    { id: "knowledge", label: t.apps.categories.knowledge },
  ];

  const filtered = APP_DEFS.filter(app => {
    const item = t.apps.items[app.id as keyof typeof t.apps.items];
    if (!item) return false;
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || app.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <Layout>
      <div className="flex flex-col h-full absolute inset-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto w-full px-4 md:px-8 py-8">
          <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{t.apps.title}</h1>
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">{t.apps.beta}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t.apps.subtitle}</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                placeholder={t.apps.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-56 placeholder:text-muted-foreground text-foreground"
              />
            </div>
          </div>

          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                  category === cat.id
                    ? "bg-foreground text-background"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filtered.map(app => {
              const item = t.apps.items[app.id as keyof typeof t.apps.items];
              if (!item) return null;
              return (
                <motion.button
                  key={app.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => createMutation.mutate(app)}
                  disabled={createMutation.isPending}
                  className={cn("w-full text-left p-4 rounded-2xl border bg-gradient-to-br transition-all shadow-sm hover:shadow-lg disabled:opacity-60", app.color)}
                >
                  <div className="text-2xl mb-2">{app.emoji}</div>
                  <div className="font-bold text-sm text-foreground">{item.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</div>
                </motion.button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No apps found</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
