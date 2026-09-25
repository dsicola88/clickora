import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandingFavicon } from "@/components/BrandingFavicon";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Home from "./pages/Home";
import PresellDashboard from "./pages/PresellDashboard";
import PresellManualPagesPage from "./pages/PresellManualPagesPage";
import PresellCreator from "./pages/PresellCreator";
import TrackingDashboard from "./pages/TrackingDashboard";
import Plataformas from "./pages/Plataformas";
import Relatorios from "./pages/Relatorios";
import Analytics from "./pages/Analytics";
import Links from "./pages/Links";
import Rotadores from "./pages/Rotadores";
import TrackingTools from "./pages/TrackingTools";
import Blacklist from "./pages/Blacklist";
import UrlBuilder from "./pages/UrlBuilder";
import Integrations from "./pages/Integrations";
import Settings from "./pages/Settings";
import Logs from "./pages/Logs";
import Plans from "./pages/Plans";
import { LandingRoot } from "./components/LandingRoot";
import AdminPanel, { AdminEntryRedirect } from "./pages/AdminPanel";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import PublicPresell from "./pages/PublicPresell";
import IntentConversionPage from "./pages/IntentConversionPage";
import AffiliateGuidePage from "./pages/AffiliateGuidePage";
import InAppUserGuidePage from "./pages/InAppUserGuidePage";
import SetupAssistantPage from "./pages/SetupAssistantPage";
import { DpilotPaidApp } from "./pages/dpilot/DpilotPaidApp";
import LegalPrivacyPage from "./pages/LegalPrivacyPage";
import LegalTermsPage from "./pages/LegalTermsPage";
import ResultsOverviewPage from "./pages/ResultsOverviewPage";
import CampaignsPage from "./pages/CampaignsPage";
import CampaignDetailPage from "./pages/CampaignDetailPage";
import CreatePresellWizardPage from "./pages/CreatePresellWizardPage";
import IntegrationsHubPage from "./pages/IntegrationsHubPage";
import SettingsHubPage from "./pages/SettingsHubPage";
import AffiliateAutomizerPage from "./pages/AffiliateAutomizerPage";

const PresellManualBuilderPage = lazy(() => import("./pages/PresellManualBuilderPage"));

function BrandingFaviconGate() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/p/")) return null;
  return <BrandingFavicon />;
}

/** Rotas novas + redirects das URLs antigas (bookmarks). */
const appRoutes = [
  { path: "/inicio", element: <Home /> },
  { path: "/ajuda", element: <InAppUserGuidePage /> },
  { path: "/conta", element: <Account /> },
  { path: "/admin", element: <AdminEntryRedirect /> },
  { path: "/admin/:tab", element: <AdminPanel /> },

  // Trabalho
  { path: "/presells", element: <PresellDashboard /> },
  { path: "/presells/nova", element: <CreatePresellWizardPage /> },
  { path: "/campanhas", element: <CampaignsPage /> },
  { path: "/campanhas/:id", element: <CampaignDetailPage /> },

  // Resultados
  { path: "/resultados", element: <ResultsOverviewPage /> },
  { path: "/resultados/conversoes", element: <Navigate to="/resultados/relatorios/conversoes" replace /> },
  { path: "/resultados/relatorios", element: <Navigate to="/resultados/relatorios/acessos" replace /> },
  { path: "/resultados/relatorios/:tab", element: <Relatorios /> },

  // Configuração
  { path: "/integracoes", element: <IntegrationsHubPage /> },
  { path: "/integracoes/postback", element: <Plataformas /> },
  { path: "/integracoes/automizer", element: <AffiliateAutomizerPage /> },
  { path: "/configuracoes", element: <SettingsHubPage /> },

  // Redirects — Presell legado
  { path: "/presell/dashboard", element: <Navigate to="/presells" replace /> },
  { path: "/presell/paginas-criadas", element: <PresellManualPagesPage /> },
  { path: "/presell/templates", element: <Navigate to="/presell/templates/editor" replace /> },
  { path: "/presell/templates/:tab", element: <PresellCreator /> },

  // Redirects — Tracking legado (páginas ainda existem para avançado / deep links)
  { path: "/tracking/dashboard", element: <Navigate to="/resultados" replace /> },
  { path: "/tracking/setup-assistant", element: <Navigate to="/presells/nova" replace /> },
  { path: "/tracking/plataformas-legacy", element: <Navigate to="/integracoes/postback" replace /> },
  { path: "/tracking/plataformas", element: <Navigate to="/integracoes/postback" replace /> },
  { path: "/tracking/integrations", element: <Navigate to="/integracoes" replace /> },
  { path: "/tracking/settings", element: <Navigate to="/configuracoes" replace /> },
  { path: "/tracking/vendas", element: <Navigate to="/resultados/conversoes" replace /> },
  { path: "/tracking/analytics", element: <Navigate to="/resultados" replace /> },
  { path: "/tracking/analytics/*", element: <Navigate to="/resultados" replace /> },
  { path: "/tracking/links", element: <Navigate to="/campanhas" replace /> },

  { path: "/tracking/relatorios", element: <Navigate to="/resultados/relatorios/acessos" replace /> },
  { path: "/tracking/relatorios/:tab", element: <Relatorios /> },
  { path: "/tracking/rotadores", element: <Rotadores /> },
  { path: "/tracking/tools/*", element: <TrackingTools /> },
  { path: "/tracking/blacklist", element: <Blacklist /> },
  { path: "/tracking/url-builder", element: <UrlBuilder /> },
  { path: "/tracking/logs", element: <Logs /> },
  { path: "/tracking/setup-assistant-legacy", element: <SetupAssistantPage /> },
  { path: "/tracking/integrations-legacy", element: <Integrations /> },
  { path: "/tracking/settings-legacy", element: <Settings /> },
  { path: "/tracking/dashboard-legacy", element: <TrackingDashboard /> },
  { path: "/tracking/vendas-legacy", element: <Navigate to="/resultados/conversoes" replace /> },
  { path: "/tracking/analytics-legacy/*", element: <Analytics /> },
  { path: "/tracking/links-legacy", element: <Links /> },
] as const;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <BrandingFaviconGate />
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/privacidade" element={<LegalPrivacyPage />} />
              <Route path="/termos" element={<LegalTermsPage />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/p/:id" element={<PublicPresell />} />
              <Route
                path="/presell/builder/:id?"
                element={
                  <ProtectedRoute>
                    <Suspense
                      fallback={
                        <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
                          Carregando editor…
                        </div>
                      }
                    >
                      <PresellManualBuilderPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route path="/plans" element={<Plans />} />
              <Route path="/planos" element={<Plans />} />
              <Route path="/presell-para-afiliados" element={<IntentConversionPage />} />
              <Route path="/rastreamento-afiliados" element={<IntentConversionPage />} />
              <Route path="/guia-vendas-afiliados" element={<AffiliateGuidePage />} />
              <Route path="/" element={<LandingRoot />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Routes>
                        <Route path="/tracking/dpilot/*" element={<DpilotPaidApp />} />
                        {appRoutes.map((route) => (
                          <Route key={route.path} path={route.path} element={route.element} />
                        ))}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
