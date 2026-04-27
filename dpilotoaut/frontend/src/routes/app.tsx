import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Bot } from "lucide-react";

import { useAuth } from "@/providers/AuthProvider";
import { APP_NAME } from "@/lib/branding";
import {
  getActiveOrganizationIdFromStorage,
  setActiveOrganizationIdInStorage,
} from "@/lib/tenant-prefs";
import { listMyWorkspaces, listProjectIdsForUser } from "@/server/app-data.functions";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [bootstrapping, setBootstrapping] = useState(true);
  const listProjects = useServerFn(listProjectIdsForUser);
  const listWorkspaces = useServerFn(listMyWorkspaces);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth/sign-in" });
      return;
    }

    if (typeof window !== "undefined" && window.location.pathname === "/app") {
      (async () => {
        try {
          const [workspaces, allProjects] = await Promise.all([
            listWorkspaces(),
            listProjects(),
          ]);
          if (!allProjects || allProjects.length === 0) {
            setBootstrapping(false);
            return;
          }
          const stored = getActiveOrganizationIdFromStorage();
          const canUse =
            stored && workspaces.some((w) => w.organizationId === stored);
          const inStoredOrg = canUse
            ? allProjects.find((p) => p.organizationId === stored)
            : undefined;
          const pick = inStoredOrg ?? allProjects[0]!;
          setActiveOrganizationIdInStorage(pick.organizationId);
          await navigate({
            to: "/app/projects/$projectId/paid",
            params: { projectId: pick.id },
            replace: true,
          });
          setBootstrapping(false);
        } catch {
          setBootstrapping(false);
        }
      })();
    } else {
      setBootstrapping(false);
    }
  }, [user, loading, navigate, listProjects, listWorkspaces]);

  if (loading || bootstrapping) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-4 text-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div
            className="flex h-9 w-9 animate-pulse items-center justify-center rounded-lg bg-gradient-primary"
            role="status"
            aria-live="polite"
            aria-label="A carregar"
          >
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-medium">A carregar o seu espaço de trabalho</span>
        </div>
        <span className="text-xs text-muted-foreground/80">{APP_NAME}</span>
      </div>
    );
  }

  if (!user) return null;

  return <Outlet />;
}
