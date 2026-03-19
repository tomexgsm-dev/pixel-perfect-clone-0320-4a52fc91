import { Layout } from "@/components/Layout";
import { useProfile } from "@/hooks/use-profile";
import { useI18n } from "@/i18n";
import { Check, Crown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function PricingPage() {
  const { profile, isPro } = useProfile();
  const { t } = useI18n();

  const handleUpgrade = () => {
    toast.info(t.pricing.comingSoon);
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
              <div className="pt-2">
                {isPro ? (
                  <div className="w-full py-2.5 text-center bg-secondary text-secondary-foreground rounded-xl text-sm font-medium">
                    {t.pricing.currentPlan}
                  </div>
                ) : (
                  <button
                    onClick={handleUpgrade}
                    className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-glow"
                  >
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
        </div>
      </div>
    </Layout>
  );
}
