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
import { LegacyDomLocalizer } from "@/i18n/LegacyDomLocalizer";
import { mergeRedirectSearch } from "@/lib/postAuthRedirect";

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
const LitePresellEntry = lazy(() => import("./pages/LitePresellEntry"));
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

/** Preserva o subpath ao migrar bookmarks de /tracking/analytics-legacy/* → /resultados/por-presell/*. */
function LegacyAnalyticsRedirect() {
  const loc = useLocation();
  const rest = loc.pathname.replace(/^\/tracking\/analytics-legacy\/?/, "") || "presells";
  return <Navigate to={`/resultados/por-presell/${rest}${loc.search}`} replace />;
}

/** /tracking/analytics → overview; /tracking/analytics/* → por-presell (preserva search). */
function LegacyTrackingAnalyticsRedirect() {
  const loc = useLocation();
  const rest = loc.pathname.replace(/^\/tracking\/analytics\/?/, "");
  if (!rest) {
    return <Navigate to={`/resultados${loc.search}${loc.hash}`} replace />;
  }
  return <Navigate to={`/resultados/por-presell/${rest}${loc.search}${loc.hash}`} replace />;
}

/** Redirect legado que mantém query/hash (ex.: ?aba=, OAuth, UTM). */
function PreserveSearchNavigate({ to }: { to: string }) {
  const loc = useLocation();
  return <Navigate to={mergeRedirectSearch(to, loc.search, loc.hash)} replace />;
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
  { path: "/resultados/conversoes", element: <PreserveSearchNavigate to="/resultados/relatorios/conversoes" /> },
  { path: "/resultados/relatorios", element: <PreserveSearchNavigate to="/resultados/relatorios/acessos" /> },
  { path: "/resultados/relatorios/:tab", element: <Relatorios /> },

  // Configuração
  { path: "/integracoes", element: <IntegrationsHubPage /> },
  { path: "/integracoes/postback", element: <Plataformas /> },
  { path: "/integracoes/google-ads", element: <GoogleAdsConnectPage /> },
  { path: "/integracoes/pixels", element: <AdPixelsConnectPage /> },
  { path: "/integracoes/meta", element: <PreserveSearchNavigate to="/integracoes/pixels?focus=meta" /> },
  { path: "/integracoes/tiktok", element: <PreserveSearchNavigate to="/integracoes/pixels?focus=tiktok" /> },
  { path: "/integracoes/automizer", element: <AffiliateAutomizerPage /> },
  { path: "/configuracoes", element: <SettingsHubPage /> },

  // Redirects — Presell legado
  { path: "/presell/dashboard", element: <PreserveSearchNavigate to="/presells" /> },
  { path: "/presell/paginas-criadas", element: <PresellManualPagesPage /> },
  /** Legado stub (D7): nunca persistia — redireciona para o wizard real. */
  { path: "/presell/templates", element: <PreserveSearchNavigate to="/presells/nova" /> },
  { path: "/presell/templates/:tab", element: <PreserveSearchNavigate to="/presells/nova" /> },

  // Superfícies canónicas (ex-legado promovido — sem rotas *-legacy activas)
  { path: "/resultados/por-presell/*", element: <Analytics /> },
  { path: "/integracoes/avancado", element: <Integrations /> },
  { path: "/configuracoes/dominio", element: <Settings /> },
  { path: "/ajuda/assistente", element: <SetupAssistantPage /> },

  // Redirects — bookmarks / URLs antigas
  { path: "/tracking/dashboard", element: <PreserveSearchNavigate to="/resultados" /> },
  { path: "/tracking/setup-assistant", element: <PreserveSearchNavigate to="/ajuda/assistente" /> },
  { path: "/tracking/plataformas-legacy", element: <PreserveSearchNavigate to="/integracoes/postback" /> },
  { path: "/tracking/plataformas", element: <PreserveSearchNavigate to="/integracoes/postback" /> },
  { path: "/tracking/integrations", element: <PreserveSearchNavigate to="/integracoes" /> },
  { path: "/tracking/settings", element: <PreserveSearchNavigate to="/configuracoes" /> },
  { path: "/tracking/vendas", element: <PreserveSearchNavigate to="/resultados/funil" /> },
  { path: "/tracking/analytics", element: <LegacyTrackingAnalyticsRedirect /> },
  { path: "/tracking/analytics/*", element: <LegacyTrackingAnalyticsRedirect /> },
  { path: "/tracking/links", element: <PreserveSearchNavigate to="/campanhas" /> },

  { path: "/tracking/relatorios", element: <PreserveSearchNavigate to="/resultados/relatorios/acessos" /> },
  { path: "/tracking/relatorios/:tab", element: <Relatorios /> },
  { path: "/rotadores", element: <PreserveSearchNavigate to="/tracking/rotadores" /> },
  { path: "/tracking/rotadores", element: <Rotadores /> },
  { path: "/tracking/tools/*", element: <TrackingTools /> },
  { path: "/tracking/blacklist", element: <Blacklist /> },
  { path: "/tracking/url-builder", element: <UrlBuilder /> },
  { path: "/tracking/logs", element: <Logs /> },
  { path: "/tracking/setup-assistant-legacy", element: <PreserveSearchNavigate to="/ajuda/assistente" /> },
  { path: "/tracking/integrations-legacy", element: <PreserveSearchNavigate to="/integracoes/avancado" /> },
  { path: "/tracking/settings-legacy", element: <PreserveSearchNavigate to="/configuracoes/dominio" /> },
  { path: "/tracking/dashboard-legacy", element: <PreserveSearchNavigate to="/integracoes" /> },
  { path: "/dpilot", element: <PreserveSearchNavigate to="/tracking/dpilot" /> },
  { path: "/tracking/vendas-legacy", element: <PreserveSearchNavigate to="/resultados/funil" /> },
  { path: "/tracking/analytics-legacy/*", element: <LegacyAnalyticsRedirect /> },
  { path: "/tracking/links-legacy", element: <PreserveSearchNavigate to="/tracking/url-builder" /> },
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
        <Route path="/l/:id" element={<LitePresellEntry />} />
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
            <Route path="/l/:id" element={<LitePresellEntry />} />
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
            <Route path="/super-presell" element={<IntentConversionPage />} />
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
          <LegacyDomLocalizer />
          <AppRouterGate />
        </AppLocaleProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
