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
import Vendas from "./pages/Vendas";
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

const PresellManualBuilderPage = lazy(() => import("./pages/PresellManualBuilderPage"));

/** Evita pedido extra e troca de favicon antes da presell pública carregar. */
function BrandingFaviconGate() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/p/")) return null;
  return <BrandingFavicon />;
}

const appRoutes = [
  { path: "/inicio", element: <Home /> },
  { path: "/ajuda", element: <InAppUserGuidePage /> },
  { path: "/conta", element: <Account /> },
  { path: "/admin", element: <AdminEntryRedirect /> },
  { path: "/admin/:tab", element: <AdminPanel /> },
  { path: "/presell/dashboard", element: <PresellDashboard /> },
  { path: "/presell/paginas-criadas", element: <PresellManualPagesPage /> },
  { path: "/presell/templates", element: <Navigate to="/presell/templates/editor" replace /> },
  { path: "/presell/templates/:tab", element: <PresellCreator /> },
  { path: "/tracking/dashboard", element: <TrackingDashboard /> },
  { path: "/tracking/plataformas", element: <Plataformas /> },
  { path: "/tracking/relatorios", element: <Navigate to="/tracking/relatorios/acessos" replace /> },
  { path: "/tracking/relatorios/:tab", element: <Relatorios /> },
  { path: "/tracking/analytics", element: <Navigate to="/tracking/analytics/presells" replace /> },
  { path: "/tracking/analytics/*", element: <Analytics /> },
  { path: "/tracking/links", element: <Links /> },
  { path: "/tracking/rotadores", element: <Rotadores /> },
  { path: "/tracking/tools/*", element: <TrackingTools /> },
  { path: "/tracking/blacklist", element: <Blacklist /> },
  { path: "/tracking/url-builder", element: <UrlBuilder /> },
  { path: "/tracking/integrations", element: <Integrations /> },
  { path: "/tracking/settings", element: <Settings /> },
  { path: "/tracking/logs", element: <Logs /> },
] as const;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 2, // 2 min
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
              {/* Public routes */}
              <Route path="/auth" element={<Auth />} />
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
              {/* Landing de planos (acessível com ou sem login; a raiz redireciona logados para /inicio) */}
              <Route path="/plans" element={<Plans />} />
              <Route path="/planos" element={<Plans />} />
              <Route path="/presell-para-afiliados" element={<IntentConversionPage />} />
              <Route path="/rastreamento-afiliados" element={<IntentConversionPage />} />
              <Route path="/guia-vendas-afiliados" element={<AffiliateGuidePage />} />
              <Route path="/" element={<LandingRoot />} />
              <Route path="/tracking/vendas" element={<AppLayout><Vendas /></AppLayout>} />
              {/* Protected routes */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Routes>
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
