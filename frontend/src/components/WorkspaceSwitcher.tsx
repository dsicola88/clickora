import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Loader2 } from "lucide-react";
import { workspaceService, type WorkspaceMineRow } from "@/services/workspaceService";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Troca o workspace activo (JWT). Só aparece se houver 2+ memberships. */
export function WorkspaceSwitcher({ className }: { className?: string }) {
  const { user, applySession } = useAuth();
  const qc = useQueryClient();
  /** Mantém a lista visível após qc.clear() (senão o switcher pisca/desaparece). */
  const [knownWorkspaces, setKnownWorkspaces] = useState<WorkspaceMineRow[]>([]);

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ["workspaces", "mine"],
    queryFn: async () => {
      const { data, error } = await workspaceService.listMine();
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (workspaces.length > 0) setKnownWorkspaces(workspaces);
  }, [workspaces]);

  const switchMut = useMutation({
    mutationFn: async (workspaceId: string) => {
      const { data, error } = await workspaceService.switchWorkspace(workspaceId);
      if (error) throw new Error(error);
      if (!data?.token || !data.user) throw new Error("Resposta de switch inválida.");
      return data;
    },
    onSuccess: (data) => {
      applySession(data.token, data.user);
      const wid = data.user.workspace_id;
      setKnownWorkspaces((prev) =>
        prev.map((w) => ({ ...w, is_active: w.workspace_id === wid })),
      );
      qc.clear();
      void qc.invalidateQueries({ queryKey: ["workspaces", "mine"] });
      toast.success(`Workspace: ${data.user.workspace_name || data.user.workspace_id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = workspaces.length > 0 ? workspaces : knownWorkspaces;

  if (!user) return null;
  if (isLoading && list.length === 0) return null;
  if (list.length < 2) return null;

  const active =
    list.find((w) => w.is_active) ||
    list.find((w) => w.workspace_id === user.workspace_id) ||
    list[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-8 max-w-[11rem] gap-1.5 px-2 text-xs font-medium", className)}
          disabled={switchMut.isPending}
          title="Trocar workspace"
        >
          {switchMut.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          ) : (
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{active?.name || user.workspace_name || "Workspace"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
          Workspaces onde é membro
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {list.map((w) => {
          const selected = w.workspace_id === (active?.workspace_id ?? user.workspace_id);
          return (
            <DropdownMenuItem
              key={w.workspace_id}
              className="flex items-start gap-2"
              disabled={selected || switchMut.isPending}
              onClick={() => {
                if (!selected) switchMut.mutate(w.workspace_id);
              }}
            >
              <Check className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", selected ? "opacity-100" : "opacity-0")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{w.name}</span>
                <span className="block text-[10px] text-muted-foreground capitalize">{w.role}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
