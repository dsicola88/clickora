import type { User } from "@/types/api";

/** Valores estáveis alinhados com `backend/src/lib/rbac.ts`. */
export const WORKSPACE_EXTRA_PERMS = {
  rotators_write: "rotators:write",
  presells_write: "presells:write",
  integrations_write: "integrations:write",
} as const;

function extraList(user: User | null | undefined): string[] {
  return user?.workspace_permissions ?? [];
}

function hasExtra(user: User | null | undefined, perm: string): boolean {
  return extraList(user).includes(perm);
}

/** Igual a `workspaceCanWriteRotators` no servidor. */
export function userCanWriteRotators(user: User | null | undefined): boolean {
  if (!user) return false;
  if (hasExtra(user, WORKSPACE_EXTRA_PERMS.rotators_write)) return true;
  const r = user.workspace_role ?? "owner";
  return r === "owner" || r === "admin" || r === "member";
}

/** Igual a `workspaceCanWritePresells` no servidor. */
export function userCanWritePresells(user: User | null | undefined): boolean {
  if (!user) return false;
  if (hasExtra(user, WORKSPACE_EXTRA_PERMS.presells_write)) return true;
  const r = user.workspace_role ?? "owner";
  return r === "owner" || r === "admin" || r === "member";
}

/** Igual a `workspaceCanWriteIntegrations` no servidor. */
export function userCanWriteIntegrations(user: User | null | undefined): boolean {
  if (!user) return false;
  if (hasExtra(user, WORKSPACE_EXTRA_PERMS.integrations_write)) return true;
  const r = user.workspace_role ?? "owner";
  return r === "owner" || r === "admin" || r === "member";
}
