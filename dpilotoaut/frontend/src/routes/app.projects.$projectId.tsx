import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Bot } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { setActiveOrganizationIdInStorage } from "@/lib/tenant-prefs";
import {
  getProjectWithOrg,
  type WorkspaceOption,
  listMyWorkspaces,
  listProjectIdsForUser,
} from "@/server/app-data.functions";

export const Route = createFileRoute("/app/projects/$projectId")({
  component: ProjectLayout,
});

interface ProjectInfo {
  id: string;
  name: string;
  org_name: string;
  org_id: string;
}

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const fetchProject = useServerFn(getProjectWithOrg);
  const listWorkspaces = useServerFn(listMyWorkspaces);
  const listProjects = useServerFn(listProjectIdsForUser);

  const onWorkspaceChange = useCallback(
    async (organizationId: string) => {
      setActiveOrganizationIdInStorage(organizationId);
      const inOrg = await listProjects({ data: { organizationId } });
      if (inOrg.length > 0) {
        const first = inOrg[0]!;
        if (first.id !== projectId) {
          await navigate({
            to: "/app/projects/$projectId/paid",
            params: { projectId: first.id },
          });
        }
      } else {
        await navigate({ to: "/app", replace: true });
      }
    },
    [listProjects, navigate, projectId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const [data, ws] = await Promise.all([
          fetchProject({ data: { projectId } }),
          listWorkspaces(),
        ]);
        if (cancelled) return;
        if (!data) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const orgName = (data.organizations as { name: string } | null)?.name ?? "Workspace";
        setWorkspaces(Array.isArray(ws) ? ws : []);
        setProject({
          id: data.id,
          name: data.name,
          org_id: data.organization_id,
          org_name: orgName,
        });
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, fetchProject, listWorkspaces]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="flex h-9 w-9 animate-pulse items-center justify-center rounded-lg bg-gradient-primary">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm">Carregando projeto…</span>
        </div>
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <h2 className="text-xl font-semibold">Projeto não encontrado</h2>
        <p className="text-sm text-muted-foreground">
          Você não tem acesso a este projeto ou ele não existe.
        </p>
        <button
          className="text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => navigate({ to: "/app" })}
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <AppShell
      projectId={project.id}
      projectName={project.name}
      orgName={project.org_name}
      workspaces={workspaces}
      activeOrganizationId={project.org_id}
      onWorkspaceChange={onWorkspaceChange}
    >
      <Outlet />
    </AppShell>
  );
}
