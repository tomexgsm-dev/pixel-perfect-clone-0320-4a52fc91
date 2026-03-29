import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/i18n";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { FreeLimitsProvider } from "@/hooks/use-free-limits";
import { SpeechSettingsProvider } from "@/hooks/use-speech-settings";

import Home from "./pages/Home";
import ChatPage from "./pages/ChatPage";
import AppsPage from "./pages/AppsPage";
import ImagesPage from "./pages/ImagesPage";
import PricingPage from "./pages/PricingPage";
import TemplatesPage from "./pages/TemplatesPage";
import ImageProPage from "./pages/ImageProPage";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";

import VideoPro from "./pages/VideoPro";
import LeadFinderPage from "./pages/LeadFinderPage";

import { Loader2 } from "lucide-react";
import { Suspense } from "react";

/* ---------------- QUERY CLIENT ---------------- */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
    mutations: {
      retry: 1,
    },
  },
});

/* ---------------- LOADER ---------------- */

function FullscreenLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
}

/* ---------------- AUTH ROUTE ---------------- */

function AuthRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullscreenLoader />;
  }

  if (user) return <Navigate to="/" replace />;

  return <AuthPage />;
}

/* ---------------- APP ---------------- */

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AuthProvider>
        <FreeLimitsProvider>
          <SpeechSettingsProvider>
            <TooltipProvider>
              <Sonner />

              <BrowserRouter>
                <Suspense fallback={<FullscreenLoader />}>
                  <Routes>
                    {/* AUTH */}
                    <Route path="/auth" element={<AuthRoute />} />

                    {/* MAIN */}
                    <Route path="/" element={<Home />} />

                    {/* CHAT */}
                    <Route path="/c/:id" element={<ChatPage />} />

                    {/* AI APPS */}
                    <Route path="/apps" element={<AppsPage />} />

                    {/* VIDEO PRO — DODANE */}
                    <Route path="/apps/video-pro" element={<VideoPro />} />

                    {/* IMAGE GENERATOR */}
                    <Route path="/images" element={<ImagesPage />} />

                    {/* IMAGE PRO */}
                    <Route path="/image-pro" element={<ImageProPage />} />

                    {/* PRICING */}
                    <Route path="/pricing" element={<PricingPage />} />

                    {/* TEMPLATES */}
                    <Route path="/templates" element={<TemplatesPage />} />

                    {/* LEADFINDER */}
                    <Route path="/leads" element={<LeadFinderPage />} />

                    {/* 404 */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </SpeechSettingsProvider>
        </FreeLimitsProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
