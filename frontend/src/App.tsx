import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import PresellCreator from "./pages/PresellCreator";
import TrackingDashboard from "./pages/TrackingDashboard";
import Vendas from "./pages/Vendas";
import Plataformas from "./pages/Plataformas";
import Relatorios from "./pages/Relatorios";
import Analytics from "./pages/Analytics";
import Links from "./pages/Links";
import TrackingTools from "./pages/TrackingTools";
import Blacklist from "./pages/Blacklist";
import UrlBuilder from "./pages/UrlBuilder";
import Integrations from "./pages/Integrations";
import Settings from "./pages/Settings";
import Logs from "./pages/Logs";
import Plans from "./pages/Plans";
import AdminPanel from "./pages/AdminPanel";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import PublicPresell from "./pages/PublicPresell";

const appRoutes = [
  { path: "/", element: <Home /> },
  { path: "/plans", element: <Plans /> },
  { path: "/conta", element: <Account /> },
  { path: "/admin", element: <AdminPanel /> },
  { path: "/presell/dashboard", element: <PresellDashboard /> },
  { path: "/presell/templates", element: <PresellCreator /> },
  { path: "/tracking/dashboard", element: <TrackingDashboard /> },
  { path: "/tracking/vendas", element: <Vendas /> },
  { path: "/tracking/plataformas", element: <Plataformas /> },
  { path: "/tracking/relatorios", element: <Relatorios /> },
  { path: "/tracking/analytics", element: <Analytics /> },
  { path: "/tracking/links", element: <Links /> },
  { path: "/tracking/tools", element: <TrackingTools /> },
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
          <BrandingFavicon />
          <AuthProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/p/:id" element={<PublicPresell />} />
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
