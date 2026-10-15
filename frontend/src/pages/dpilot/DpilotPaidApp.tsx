import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { userCanAccessDpilotAds } from "@/lib/dpilotAccess";
import { paidAdsService } from "@/services/paidAdsService";
import { DpilotPaidLayout } from "./DpilotPaidLayout";
import { DpilotPaidProvider, UUID_RE } from "./DpilotPaidContext";
import { DpilotGoogleWizardPage } from "./DpilotGoogleWizardPage";
import { DpilotGoogleCampaignStudioPage } from "./DpilotGoogleCampaignStudioPage";
import { DpilotMetaWizardPage } from "./DpilotMetaWizardPage";
import { DpilotTiktokWizardPage } from "./DpilotTiktokWizardPage";
import {
  DpilotAprovacoesPage,
  DpilotAuditoriaPage,
  DpilotCampanhasPage,
  DpilotEquipaPage,
  DpilotGooglePage,
  DpilotLandingsPage,
  DpilotLigacoesPage,
  DpilotMetaCampanhasPage,
  DpilotMetaPage,
  DpilotTiktokCampanhasPage,
  DpilotTiktokPage,
  DpilotVisaoPage,
} from "./DpilotPaidPages";

function DpilotIndexRedirect() {
  const [searchParams] = useSearchParams();
  const [to, setTo] = useState<string | "wait" | "empty">("wait");
  const qp = searchParams.get("project");
  const landing = searchParams.get("landing");
  useEffect(() => {
    void (async () => {
      const { data } = await paidAdsService.listProjects();
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
    return <p className="text-sm text-muted-foreground px-4 py-10">A carregar módulo de anúncios…</p>;
  }
  if (to === "empty") {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Sem projecto de anúncios</CardTitle>
            <CardDescription>Confirma a API, migrações e seed.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  return <Navigate to={to} replace />;
}

/** Se nenhuma rota descendent casar, evita o main ficar vazio (ecrã branco). */
function DpilotRouteFallback() {
  const { pathname, search } = useLocation();
  return (
    <div className="mx-auto max-w-lg space-y-4 px-2 py-8">
      <h1 className="text-lg font-semibold">Anúncios</h1>
      <p className="text-sm text-muted-foreground">
        Rota de anúncios não reconhecida. Confirma o endereço ou volta ao módulo.
      </p>
      <p className="text-xs font-mono text-muted-foreground break-all">
        {pathname}
        {search}
      </p>
      <Button asChild>
        <Link to="/tracking/dpilot">Voltar a Anúncios</Link>
      </Button>
    </div>
  );
}

function DpilotProjectShell() {
  const { projectId } = useParams();
  if (!projectId || !UUID_RE.test(projectId)) {
    return <p className="p-4 text-sm text-destructive">ID de projecto inválido.</p>;
  }
  return (
    <DpilotPaidProvider projectId={projectId}>
      <DpilotPaidLayout />
    </DpilotPaidProvider>
  );
}

function PlanGate({ children }: { children: React.ReactNode }) {
  const { user, isSuperAdmin, loading } = useAuth();
  if (loading) {
    return <p className="px-2 py-8 text-sm text-muted-foreground">A carregar sessão…</p>;
  }
  const allowed = userCanAccessDpilotAds(user, isSuperAdmin);
  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
        <h1 className="text-xl font-semibold">Anúncios (Paid Autopilot no monólito)</h1>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Plano</CardTitle>
            <CardDescription>Upgrade para Pro Anual para desbloquear.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/planos">Ver planos</Link>
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
          <Route path="visao" element={<DpilotVisaoPage />} />
          <Route path="ligacoes" element={<DpilotLigacoesPage />} />
          <Route path="google" element={<DpilotGooglePage />} />
          <Route path="meta/nova" element={<DpilotMetaWizardPage />} />
          <Route path="meta/campanhas" element={<DpilotMetaCampanhasPage />} />
          <Route path="meta" element={<DpilotMetaPage />} />
          <Route path="tiktok/nova" element={<DpilotTiktokWizardPage />} />
          <Route path="tiktok" element={<DpilotTiktokPage />} />
          <Route path="tiktok/campanhas" element={<DpilotTiktokCampanhasPage />} />
          <Route path="campanhas/nova" element={<DpilotGoogleWizardPage />} />
          <Route path="campanhas/:campaignId/google" element={<DpilotGoogleCampaignStudioPage />} />
          <Route path="campanhas" element={<DpilotCampanhasPage />} />
          <Route path="aprovacoes" element={<DpilotAprovacoesPage />} />
          <Route path="auditoria" element={<DpilotAuditoriaPage />} />
          <Route path="landings" element={<DpilotLandingsPage />} />
          <Route path="equipa" element={<DpilotEquipaPage />} />
        </Route>
        <Route path="*" element={<DpilotRouteFallback />} />
      </Routes>
    </PlanGate>
  );
}
