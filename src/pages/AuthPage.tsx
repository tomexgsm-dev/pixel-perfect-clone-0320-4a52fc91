import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Sparkles, Loader2, Mail, Lock } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t.auth.loginSuccess);
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success(t.auth.signupSuccess);
      }
    } catch (err: any) {
      toast.error(err.message || t.auth.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-card border border-border shadow-2xl flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
            <Sparkles className="w-8 h-8 text-primary drop-shadow-lg" />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Nexus AI</h1>
          <p className="text-muted-foreground text-sm">{isLogin ? t.auth.loginSubtitle : t.auth.signupSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.auth.email}
                required
                className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.auth.password}
                required
                minLength={6}
                className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-glow disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isLogin ? t.auth.loginBtn : t.auth.signupBtn}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? t.auth.noAccount : t.auth.hasAccount}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary font-medium hover:underline underline-offset-4"
          >
            {isLogin ? t.auth.signupLink : t.auth.loginLink}
          </button>
        </p>
      </div>
    </div>
  );
}
