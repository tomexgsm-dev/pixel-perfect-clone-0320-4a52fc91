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
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AuthRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;
  return <AuthPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AuthProvider>
        <FreeLimitsProvider>
        <SpeechSettingsProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/" element={<Home />} />
              <Route path="/c/:id" element={<ChatPage />} />
              <Route path="/apps" element={<AppsPage />} />
              <Route path="/images" element={<ImagesPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </SpeechSettingsProvider>
        </FreeLimitsProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
