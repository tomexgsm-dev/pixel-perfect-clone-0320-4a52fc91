import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MessageSquare, Plus, Trash2, Menu, X, Sparkles, Image, LayoutGrid, Crown, LogOut, LogIn, Layers, Wand2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n, Lang } from "@/i18n";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useFreeLimits } from "@/hooks/use-free-limits";

interface LayoutProps {
  children: ReactNode;
}

const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "pl", label: "PL" },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const queryClient = useQueryClient();
  const { t, lang, setLang } = useI18n();
  const { user, signOut } = useAuth();
  const { isPro } = useProfile();
  const { chatLeft, imagesLeft, maxChat, maxImages } = useFreeLimits();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (opts: { title?: string; appId?: string; systemPrompt?: string } = {}) => {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          title: opts?.title || "New Chat",
          app_id: opts?.appId,
          system_prompt: opts?.systemPrompt,
          user_id: user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate(`/c/${data.id}`);
      setIsSidebarOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("conversations").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (location.pathname === `/c/${id}`) navigate("/");
    },
  });

  const handleNewChat = () => createMutation.mutate({});

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed md:static inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 shadow-2xl md:shadow-none",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-glow">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-foreground">Nexus AI</span>
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 space-y-1">
          <button
            onClick={handleNewChat}
            disabled={createMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl text-sm font-medium transition-all border border-border/50"
          >
            <Plus className="w-4 h-4" />
            {t.sidebar.newConversation}
          </button>

          {/* Images */}
          <Link
            to="/images"
            className={cn(
              "w-full flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all border",
              location.pathname === "/images"
                ? "bg-sidebar-accent text-sidebar-accent-foreground border-border/50"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 border-transparent"
            )}
          >
            <Image className="w-4 h-4" />
            {t.sidebar.images}
          </Link>

          {/* Image Pro */}
          <Link
            to="/image-pro"
            className={cn(
              "w-full flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all border",
              location.pathname === "/image-pro"
                ? "bg-sidebar-accent text-sidebar-accent-foreground border-border/50"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 border-transparent"
            )}
          >
            <Wand2 className="w-4 h-4" />
            Image Pro
          </Link>

          {/* ⭐ NEW: VideoPro */}
          <Link
            to="/apps/video-pro"
            className={cn(
              "w-full flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all border",
              location.pathname === "/apps/video-pro"
                ? "bg-sidebar-accent text-sidebar-accent-foreground border-border/50"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 border-transparent"
            )}
          >
            <Wand2 className="w-4 h-4" />
            VideoPro
          </Link>

          {/* Apps */}
          <Link
            to="/apps"
            className={cn(
              "w-full flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all border",
              location.pathname === "/apps"
                ? "bg-sidebar-accent text-sidebar-accent-foreground border-border/50"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 border-transparent"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            {t.sidebar.apps}
          </Link>

          {/* Templates */}
          <Link
            to="/templates"
            className={cn(
              "w-full flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all border",
              location.pathname === "/templates"
                ? "bg-sidebar-accent text-sidebar-accent-foreground border-border/50"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 border-transparent"
            )}
          >
            <Layers className="w-4 h-4" />
            {t.templates.sidebarLabel}
          </Link>

          {/* Pricing */}
          <Link
            to="/pricing"
            className={cn(
              "w-full flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all border",
              location.pathname === "/pricing"
                ? "bg-sidebar-accent text-sidebar-accent-foreground border-border/50"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 border-transparent"
            )}
          >
            <Crown className="w-4 h-4" />
            {t.sidebar.pricing}
            {isPro && <span className="ml-auto text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-bold">PRO</span>}
          </Link>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="text-xs font-semibold text-sidebar-foreground px-3 py-2 uppercase tracking-wider">
            {t.sidebar.history}
          </div>

          {isLoading ? (
            <div className="space-y-2 px-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-sidebar-accent/50 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : !conversations?.length ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              {t.sidebar.noConversations}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {conversations.map(conv => {
                const isActive = location.pathname === `/c/${conv.id}`;
                return (
                  <motion.div
                    key={conv.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className={cn(
                      "group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors text-sm",
                      isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}>
                      <Link to={`/c/${conv.id}`} className="flex-1 flex items-center gap-3 truncate" onClick={() => setIsSidebarOpen(false)}>
                        <MessageSquare className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                        <span className="truncate">{conv.title}</span>
                      </Link>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(conv.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/20 hover:text-destructive rounded-md transition-all text-muted-foreground"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* User info */}
        <div className="p-3 border-t border-sidebar-border">
          {user ? (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground">
                {user.email?.charAt(0).toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{user.email}</p>
                <p className="text-xs text-muted-foreground">{isPro ? "PRO ∞" : "Free"}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-lg hover:bg-destructive/20 hover:text-destructive text-muted-foreground transition-colors"
                title={t.sidebar.logout}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  💬 {chatLeft}/{maxChat} · 🖼 {imagesLeft}/{maxImages}
                </p>
              </div>
              <Link
                to="/auth"
                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:scale-105 transition-transform"
              >
                <LogIn className="w-3 h-3" />
                PRO
              </Link>
            </div>
          )}
        </div>

        <div className="px-4 pb-3 text-xs text-muted-foreground flex items-center justify-between">
          <span>{t.sidebar.poweredBy}</span>
          <div className="flex gap-1">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={cn(
                  "px-2 py-0.5 rounded text-xs transition-colors",
                  lang === l.code ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-14 flex items-center px-4 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-lg md:hidden">
            <Menu className="w-5 h-5" />
          </button>
          <div className="font-display font-semibold ml-2 md:hidden text-foreground">Nexus AI</div>
        </header>

        <div className="flex-1 overflow-y-auto relative">
          {children}
        </div>
      </main>
    </div>
  );
}
