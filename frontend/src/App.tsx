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
import { AppLocaleProvider } from "@/i18n/AppLocaleProvider";

const AppLayout = lazy(() =>
  import("@/components/AppLayout").then((m) => ({ default: m.AppLayout })),
);
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Home = lazy(() => import("./pages/Home"));
const PresellDashboard = lazy(() => import("./pages/PresellDashboard"));
const PresellManualPagesPage = lazy(() => import("./pages/PresellManualPagesPage"));
const Plataformas = lazy(() => import("./pages/Plataformas"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Rotadores = lazy(() => import("./pages/Rotadores"));
const TrackingTools = lazy(() => import("./pages/TrackingTools"));
const Blacklist = lazy(() => import("./pages/Blacklist"));
const UrlBuilder = lazy(() => import("./pages/UrlBuilder"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Settings = lazy(() => import("./pages/Settings"));
const Logs = lazy(() => import("./pages/Logs"));
const Plans = lazy(() => import("./pages/Plans"));
const AgencyReadyPage = lazy(() => import("./pages/AgencyReadyPage"));
const LandingRoot = lazy(() =>
  import("./components/LandingRoot").then((m) => ({ default: m.LandingRoot })),
);
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const AdminEntryRedirect = lazy(() =>
  import("./pages/AdminPanel").then((m) => ({ default: m.AdminEntryRedirect })),
);
const Account = lazy(() => import("./pages/Account"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PublicPresell = lazy(() => import("./pages/PublicPresell"));
const IntentConversionPage = lazy(() => import("./pages/IntentConversionPage"));
const AffiliateGuidePage = lazy(() => import("./pages/AffiliateGuidePage"));
const InAppUserGuidePage = lazy(() => import("./pages/InAppUserGuidePage"));
const SetupAssistantPage = lazy(() => import("./pages/SetupAssistantPage"));
const DpilotPaidApp = lazy(() =>
  import("./pages/dpilot/DpilotPaidApp").then((m) => ({ default: m.DpilotPaidApp })),
);
const LegalPrivacyPage = lazy(() => import("./pages/LegalPrivacyPage"));
const LegalTermsPage = lazy(() => import("./pages/LegalTermsPage"));
const LegalMedicalDisclaimerPage = lazy(() => import("./pages/LegalMedicalDisclaimerPage"));
const ResultsOverviewPage = lazy(() => import("./pages/ResultsOverviewPage"));
const Vendas = lazy(() => import("./pages/Vendas"));
const CampaignsPage = lazy(() => import("./pages/CampaignsPage"));
const CampaignDetailPage = lazy(() => import("./pages/CampaignDetailPage"));
const CreatePresellWizardPage = lazy(() => import("./pages/CreatePresellWizardPage"));
const IntegrationsHubPage = lazy(() => import("./pages/IntegrationsHubPage"));
const GoogleAdsConnectPage = lazy(() => import("./pages/GoogleAdsConnectPage"));
const AdPixelsConnectPage = lazy(() => import("./pages/AdPixelsConnectPage"));
const SettingsHubPage = lazy(() => import("./pages/SettingsHubPage"));
const AffiliateAutomizerPage = lazy(() => import("./pages/AffiliateAutomizerPage"));
const KeywordsPage = lazy(() => import("./pages/KeywordsPage"));
const LessonsPage = lazy(() => import("./pages/LessonsPage"));
const PresellManualBuilderPage = lazy(() => import("./pages/PresellManualBuilderPage"));
const AdminSalesPageBuilderPage = lazy(() => import("./pages/AdminSalesPageBuilderPage"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      A carregar…
    </div>
  );
}

/** Fallback mínimo em /p/ — nunca `null` (página em branco permanente se o lazy falhar). */
function PublicPresellFallback() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-500"
      style={{ backgroundColor: "hsl(40 33% 98%)" }}
      aria-busy="true"
    >
      Loading…
    </div>
  );
}

function BrandingFaviconGate() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/p/")) return null;
  return <BrandingFavicon />;
}

/** Rotas novas + redirects das URLs antigas (bookmarks). */
const appRoutes = [
  { path: "/inicio", element: <Home /> },
  { path: "/aulas", element: <LessonsPage /> },
  { path: "/agency", element: <AgencyReadyPage /> },
  { path: "/pronto-agency", element: <AgencyReadyPage /> },
  { path: "/ajuda", element: <InAppUserGuidePage /> },
  { path: "/conta", element: <Account /> },
  { path: "/admin", element: <AdminEntryRedirect /> },
  { path: "/admin/:tab", element: <AdminPanel /> },

  // Trabalho
  { path: "/presells", element: <PresellDashboard /> },
  { path: "/presells/nova", element: <CreatePresellWizardPage /> },
  { path: "/campanhas", element: <CampaignsPage /> },
  { path: "/campanhas/:id", element: <CampaignDetailPage /> },
  { path: "/palavras-chave", element: <KeywordsPage /> },

  // Resultados
  { path: "/resultados", element: <ResultsOverviewPage /> },
  { path: "/resultados/funil", element: <Vendas /> },
  { path: "/resultados/conversoes", element: <Navigate to="/resultados/relatorios/conversoes" replace /> },
  { path: "/resultados/relatorios", element: <Navigate to="/resultados/relatorios/acessos" replace /> },
  { path: "/resultados/relatorios/:tab", element: <Relatorios /> },

  // Configuração
  { path: "/integracoes", element: <IntegrationsHubPage /> },
  { path: "/integracoes/postback", element: <Plataformas /> },
  { path: "/integracoes/google-ads", element: <GoogleAdsConnectPage /> },
  { path: "/integracoes/pixels", element: <AdPixelsConnectPage /> },
  { path: "/integracoes/meta", element: <Navigate to="/integracoes/pixels" replace /> },
  { path: "/integracoes/tiktok", element: <Navigate to="/integracoes/pixels" replace /> },
  { path: "/integracoes/automizer", element: <AffiliateAutomizerPage /> },
  { path: "/configuracoes", element: <SettingsHubPage /> },

  // Redirects — Presell legado
  { path: "/presell/dashboard", element: <Navigate to="/presells" replace /> },
  { path: "/presell/paginas-criadas", element: <PresellManualPagesPage /> },
  /** Legado stub (D7): nunca persistia — redireciona para o wizard real. */
  { path: "/presell/templates", element: <Navigate to="/presells/nova" replace /> },
  { path: "/presell/templates/:tab", element: <Navigate to="/presells/nova" replace /> },

  // Redirects — Tracking legado (páginas ainda existem para avançado / deep links)
  { path: "/tracking/dashboard", element: <Navigate to="/resultados" replace /> },
  { path: "/tracking/setup-assistant", element: <Navigate to="/presells/nova" replace /> },
  { path: "/tracking/plataformas-legacy", element: <Navigate to="/integracoes/postback" replace /> },
  { path: "/tracking/plataformas", element: <Navigate to="/integracoes/postback" replace /> },
  { path: "/tracking/integrations", element: <Navigate to="/integracoes" replace /> },
  { path: "/tracking/settings", element: <Navigate to="/configuracoes" replace /> },
  { path: "/tracking/vendas", element: <Navigate to="/resultados/funil" replace /> },
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
  { path: "/tracking/dashboard-legacy", element: <Navigate to="/integracoes/pixels" replace /> },
  { path: "/dpilot", element: <Navigate to="/tracking/dpilot" replace /> },
  { path: "/tracking/vendas-legacy", element: <Navigate to="/resultados/funil" replace /> },
  { path: "/tracking/analytics-legacy/*", element: <Analytics /> },
  { path: "/tracking/links-legacy", element: <Navigate to="/tracking/url-builder" replace /> },
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

/** Árvore mínima para landers /p/ — sem Auth/Toaster (menos JS e sem /me a competir com LCP). */
function PublicPresellShell() {
  return (
    <Suspense fallback={<PublicPresellFallback />}>
      <Routes>
        <Route path="/p/:id" element={<PublicPresell />} />
      </Routes>
    </Suspense>
  );
}

function AuthenticatedAppShell() {
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrandingFaviconGate />
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/privacidade" element={<LegalPrivacyPage />} />
            <Route path="/termos" element={<LegalTermsPage />} />
            <Route path="/aviso-medico" element={<LegalMedicalDisclaimerPage />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/p/:id" element={<PublicPresell />} />
            <Route
              path="/presell/builder/:id?"
              element={
                <ProtectedRoute>
                  <Suspense
                    fallback={
                      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
                        Loading editor… / A carregar editor…
                      </div>
                    }
                  >
                    <PresellManualBuilderPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/sales-page-builder"
              element={
                <ProtectedRoute>
                  <Suspense
                    fallback={
                      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
                        Loading editor… / A carregar editor…
                      </div>
                    }
                  >
                    <AdminSalesPageBuilderPage />
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
        </Suspense>
      </AuthProvider>
    </TooltipProvider>
  );
}

function AppRouterGate() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/p/")) return <PublicPresellShell />;
  return <AuthenticatedAppShell />;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLocaleProvider>
          <AppRouterGate />
        </AppLocaleProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
