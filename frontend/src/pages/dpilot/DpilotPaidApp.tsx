import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { userCanAccessDpilotAds } from "@/lib/dpilotAccess";
import { paidAdsService } from "@/services/paidAdsService";
import { DpilotPaidLayout } from "./DpilotPaidLayout";
import { DpilotPaidProvider, UUID_RE } from "./DpilotPaidContext";

/** Shell leve; páginas/wizards pesados só carregam na rota correspondente. */
const DpilotGoogleWizardPage = lazy(() =>
  import("./DpilotGoogleWizardPage").then((m) => ({ default: m.DpilotGoogleWizardPage })),
);
const DpilotGoogleCampaignStudioPage = lazy(() =>
  import("./DpilotGoogleCampaignStudioPage").then((m) => ({
    default: m.DpilotGoogleCampaignStudioPage,
  })),
);
const DpilotMetaWizardPage = lazy(() =>
  import("./DpilotMetaWizardPage").then((m) => ({ default: m.DpilotMetaWizardPage })),
);
const DpilotTiktokWizardPage = lazy(() =>
  import("./DpilotTiktokWizardPage").then((m) => ({ default: m.DpilotTiktokWizardPage })),
);

const DpilotVisaoPage = lazy(() =>
  import("./DpilotPaidPages").then((m) => ({ default: m.DpilotVisaoPage })),
);
const DpilotLigacoesPage = lazy(() =>
  import("./DpilotPaidPages").then((m) => ({ default: m.DpilotLigacoesPage })),
);
const DpilotGooglePage = lazy(() =>
  import("./DpilotPaidPages").then((m) => ({ default: m.DpilotGooglePage })),
);
const DpilotMetaPage = lazy(() =>
  import("./DpilotPaidPages").then((m) => ({ default: m.DpilotMetaPage })),
);
const DpilotMetaCampanhasPage = lazy(() =>
  import("./DpilotPaidPages").then((m) => ({ default: m.DpilotMetaCampanhasPage })),
);
const DpilotTiktokPage = lazy(() =>
  import("./DpilotPaidPages").then((m) => ({ default: m.DpilotTiktokPage })),
);
const DpilotTiktokCampanhasPage = lazy(() =>
  import("./DpilotPaidPages").then((m) => ({ default: m.DpilotTiktokCampanhasPage })),
);
const DpilotCampanhasPage = lazy(() =>
  import("./DpilotPaidPages").then((m) => ({ default: m.DpilotCampanhasPage })),
);
const DpilotAprovacoesPage = lazy(() =>
  import("./DpilotPaidPages").then((m) => ({ default: m.DpilotAprovacoesPage })),
);
const DpilotAuditoriaPage = lazy(() =>
  import("./DpilotPaidPages").then((m) => ({ default: m.DpilotAuditoriaPage })),
);
const DpilotLandingsPage = lazy(() =>
  import("./DpilotPaidPages").then((m) => ({ default: m.DpilotLandingsPage })),
);
const DpilotEquipaPage = lazy(() =>
  import("./DpilotPaidPages").then((m) => ({ default: m.DpilotEquipaPage })),
);

function PageFallback() {
  const { t } = useAppLocale();
  return <p className="px-4 py-10 text-sm text-muted-foreground">{t("pages.dpilot.app.loading")}</p>;
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

function DpilotIndexRedirect() {
  const { t } = useAppLocale();
  const [searchParams] = useSearchParams();
  const [to, setTo] = useState<string | "wait" | "empty" | "error">("wait");
  const qp = searchParams.get("project");
  const landing = searchParams.get("landing");
  useEffect(() => {
    void (async () => {
      const { data, error } = await paidAdsService.listProjects();
      if (error) {
        setTo("error");
        return;
      }
      const first = data?.projects?.[0]?.id;
      const project = qp && UUID_RE.test(qp) ? qp : first;
      if (!project) {
        setTo("empty");
        return;
      }
      if (landing?.trim()) {
        const q = new URLSearchParams();
        q.set("landing", landing.trim());
        setTo(`/tracking/dpilot/p/${project}/campanhas/nova?${q.toString()}`);
        return;
      }
      setTo(`/tracking/dpilot/p/${project}/visao`);
    })();
  }, [qp, landing]);
  if (to === "wait") {
    return (
      <p className="text-sm text-muted-foreground px-4 py-10">{t("pages.dpilot.app.loadingModule")}</p>
    );
  }
  if (to === "error") {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>{t("pages.dpilot.app.loadErrorTitle")}</CardTitle>
            <CardDescription>{t("pages.dpilot.app.loadErrorDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (to === "empty") {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>{t("pages.dpilot.app.noProjectTitle")}</CardTitle>
            <CardDescription>{t("pages.dpilot.app.noProjectDesc")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  return <Navigate to={to} replace />;
}

/** Se nenhuma rota descendent casar, evita o main ficar vazio (ecrã branco). */
function DpilotRouteFallback() {
  const { t } = useAppLocale();
  const { pathname, search } = useLocation();
  return (
    <div className="mx-auto max-w-lg space-y-4 px-2 py-8">
      <h1 className="text-lg font-semibold">{t("pages.dpilot.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("pages.dpilot.app.routeUnknownBody")}</p>
      <p className="text-xs font-mono text-muted-foreground break-all">
        {pathname}
        {search}
      </p>
      <Button asChild>
        <Link to="/tracking/dpilot">{t("pages.dpilot.app.backToModule")}</Link>
      </Button>
    </div>
  );
}

function DpilotProjectShell() {
  const { t } = useAppLocale();
  const { projectId } = useParams();
  if (!projectId || !UUID_RE.test(projectId)) {
    return <p className="p-4 text-sm text-destructive">{t("pages.dpilot.app.invalidProject")}</p>;
  }
  return (
    <DpilotPaidProvider projectId={projectId}>
      <DpilotPaidLayout />
    </DpilotPaidProvider>
  );
}

/** Alias absoluto — evita ambiguidades de Navigate relativo em rotas aninhadas. */
function DpilotMotorAliasRedirect() {
  const { projectId } = useParams();
  if (!projectId || !UUID_RE.test(projectId)) {
    return <Navigate to="/tracking/dpilot" replace />;
  }
  return <Navigate to={`/tracking/dpilot/p/${projectId}/auditoria`} replace />;
}

function PlanGate({ children }: { children: React.ReactNode }) {
  const { t } = useAppLocale();
  const { user, isSuperAdmin, loading } = useAuth();
  if (loading) {
    return (
      <p className="px-2 py-8 text-sm text-muted-foreground">{t("pages.dpilot.app.loadingSession")}</p>
    );
  }
  const allowed = userCanAccessDpilotAds(user, isSuperAdmin);
  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
        <h1 className="text-xl font-semibold">{t("pages.dpilot.app.planGateTitle")}</h1>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("pages.dpilot.app.planTitle")}</CardTitle>
            <CardDescription>{t("pages.dpilot.app.planDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/planos">{t("pages.dpilot.app.viewPlans")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}

export function DpilotPaidApp() {
  return (
    <PlanGate>
      {/**
       * Caminhos relativos ao route pai `path="/tracking/dpilot/*"` em `App.tsx`.
       * Com caminhos absolutos aqui, o <Routes> descendentes por vezes não casava
       * nada (ecrã principal vazio) — ver guia "descendant routes" do React Router v6.
       */}
      <Routes>
        <Route index element={<DpilotIndexRedirect />} />
        <Route path="p/:projectId" element={<DpilotProjectShell />}>
          <Route index element={<Navigate to="visao" replace />} />
          <Route path="visao" element={<LazyPage><DpilotVisaoPage /></LazyPage>} />
          <Route path="ligacoes" element={<LazyPage><DpilotLigacoesPage /></LazyPage>} />
          <Route path="google" element={<LazyPage><DpilotGooglePage /></LazyPage>} />
          <Route path="meta/nova" element={<LazyPage><DpilotMetaWizardPage /></LazyPage>} />
          <Route path="meta/campanhas" element={<LazyPage><DpilotMetaCampanhasPage /></LazyPage>} />
          <Route path="meta" element={<LazyPage><DpilotMetaPage /></LazyPage>} />
          <Route path="tiktok/nova" element={<LazyPage><DpilotTiktokWizardPage /></LazyPage>} />
          <Route path="tiktok" element={<LazyPage><DpilotTiktokPage /></LazyPage>} />
          <Route path="tiktok/campanhas" element={<LazyPage><DpilotTiktokCampanhasPage /></LazyPage>} />
          <Route path="campanhas/nova" element={<LazyPage><DpilotGoogleWizardPage /></LazyPage>} />
          <Route
            path="campanhas/:campaignId/google"
            element={<LazyPage><DpilotGoogleCampaignStudioPage /></LazyPage>}
          />
          <Route path="campanhas" element={<LazyPage><DpilotCampanhasPage /></LazyPage>} />
          <Route path="aprovacoes" element={<LazyPage><DpilotAprovacoesPage /></LazyPage>} />
          <Route path="auditoria" element={<LazyPage><DpilotAuditoriaPage /></LazyPage>} />
          {/* Alias legado — e-mails/alerts usavam /motor */}
          <Route path="motor" element={<DpilotMotorAliasRedirect />} />
          <Route path="landings" element={<LazyPage><DpilotLandingsPage /></LazyPage>} />
          <Route path="equipa" element={<LazyPage><DpilotEquipaPage /></LazyPage>} />
        </Route>
        <Route path="*" element={<DpilotRouteFallback />} />
      </Routes>
    </PlanGate>
  );
}
