import { useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/i18n";
import { Check, Crown, Zap, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useState } from "react";

export default function PricingPage() {
  const { profile, isPro } = useProfile();
  const { user } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [checkingOut, setCheckingOut] = useState(false);
  const [checking, setChecking] = useState(false);

  // Check subscription on mount and after success
  useEffect(() => {
    if (user) {
      checkSubscription();
    }
  }, [user]);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Subskrypcja aktywowana! Sprawdzanie statusu...");
      checkSubscription();
    }
  }, [searchParams]);

  const checkSubscription = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      console.error("Check subscription error:", err);
    } finally {
      setChecking(false);
    }
  };

  const handleUpgrade = async () => {
    setCheckingOut(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error(err.message || "Error creating checkout");
    } finally {
      setCheckingOut(false);
    }
  };

  const handleManage = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error(err.message || "Error opening portal");
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-full absolute inset-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full px-4 md:px-8 py-8">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-display font-bold mb-2">{t.pricing.title}</h1>
            <p className="text-muted-foreground">{t.pricing.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Free */}
            <div className={cn(
              "bg-card border rounded-2xl p-6 space-y-4",
              !isPro ? "border-primary ring-2 ring-primary/20" : "border-border"
            )}>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-xl font-bold">{t.pricing.free}</h2>
              </div>
              <p className="text-3xl font-bold">0 zł<span className="text-sm font-normal text-muted-foreground"> / {t.pricing.month}</span></p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> {t.pricing.freeChat}</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> {t.pricing.freeImages}</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> {t.pricing.freeApps}</li>
              </ul>
              {!isPro && (
                <div className="pt-2">
                  <div className="w-full py-2.5 text-center bg-secondary text-secondary-foreground rounded-xl text-sm font-medium">
                    {t.pricing.currentPlan}
                  </div>
                </div>
              )}
            </div>

            {/* Pro */}
            <div className={cn(
              "bg-card border rounded-2xl p-6 space-y-4 relative overflow-hidden",
              isPro ? "border-primary ring-2 ring-primary/20" : "border-border"
            )}>
              <div className="absolute top-3 right-3 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-lg">
                PRO
              </div>
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-500" />
                <h2 className="text-xl font-bold">{t.pricing.pro}</h2>
              </div>
              <p className="text-3xl font-bold">39 zł<span className="text-sm font-normal text-muted-foreground"> / {t.pricing.month}</span></p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> {t.pricing.proChat}</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> {t.pricing.proImages}</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> {t.pricing.proApps}</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> {t.pricing.proPriority}</li>
              </ul>
              <div className="pt-2 space-y-2">
                {isPro ? (
                  <>
                    <div className="w-full py-2.5 text-center bg-secondary text-secondary-foreground rounded-xl text-sm font-medium">
                      {t.pricing.currentPlan}
                    </div>
                    <button
                      onClick={handleManage}
                      className="w-full py-2 text-center border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {t.pricing.manageBtn}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleUpgrade}
                    disabled={checkingOut}
                    className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-glow disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {checkingOut && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t.pricing.upgradeBtn}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Usage */}
          {profile && profile.plan === "free" && (
            <div className="mt-10 bg-card border border-border rounded-2xl p-6 max-w-2xl mx-auto">
              <h3 className="font-semibold mb-4">{t.pricing.usage}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t.pricing.chatRemaining}</p>
                  <p className="text-2xl font-bold">{profile.free_chat_left} / 20</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.pricing.imagesRemaining}</p>
                  <p className="text-2xl font-bold">{profile.free_images_left} / 5</p>
                </div>
              </div>
            </div>
          )}

          {checking && (
            <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">{t.pricing.checking}</span>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
