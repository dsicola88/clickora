import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout de `/paid`: as sub-rotas (Aprovações, Auditoria, Google/Meta/TikTok, campanhas)
 * renderizam em `<Outlet />`. A visão geral está em `app.projects.$projectId.paid.index.tsx`.
 */
export const Route = createFileRoute("/app/projects/$projectId/paid")({
  component: PaidLayout,
});

function PaidLayout() {
  return <Outlet />;
}
