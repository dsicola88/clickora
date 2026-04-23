import type { WorkspaceRole } from "@prisma/client";

export type WorkspaceCapability = "read" | "write" | "admin" | "billing";

/** Permissões extra além do papel (strings estáveis para API e auditoria). */
const EXTRA = {
  integrations_write: "integrations:write",
  rotators_write: "rotators:write",
  presells_write: "presells:write",
} as const;

export type ExtraPermission = (typeof EXTRA)[keyof typeof EXTRA];

export function parseExtraPermissions(raw: unknown): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 120);
}

export function workspaceHasExtraPermission(memberPermissions: unknown, perm: string): boolean {
  return parseExtraPermissions(memberPermissions).includes(perm);
}

/**
 * Capacidades por papel (sem overrides).
 * - viewer: só leitura
 * - member: leitura + escrita operacional
 * - admin: quase tudo exceto facturação explícita
 * - owner: tudo
 */
export function workspaceRoleAllows(role: WorkspaceRole | undefined, cap: WorkspaceCapability): boolean {
  if (!role || role === "owner") return true;
  if (role === "admin") return cap !== "billing";
  if (role === "member") return cap === "read" || cap === "write";
  if (role === "viewer") return cap === "read";
  return false;
}

export function workspaceCanWriteRotators(role: WorkspaceRole | undefined, memberPermissions?: unknown): boolean {
  if (workspaceHasExtraPermission(memberPermissions, EXTRA.rotators_write)) return true;
  return role === "owner" || role === "admin" || role === "member";
}

export function workspaceCanWritePresells(role: WorkspaceRole | undefined, memberPermissions?: unknown): boolean {
  if (workspaceHasExtraPermission(memberPermissions, EXTRA.presells_write)) return true;
  return role === "owner" || role === "admin" || role === "member";
}

export function workspaceCanWriteIntegrations(role: WorkspaceRole | undefined, memberPermissions?: unknown): boolean {
  if (workspaceHasExtraPermission(memberPermissions, EXTRA.integrations_write)) return true;
  return role === "owner" || role === "admin" || role === "member";
}

export function workspaceCanManageMembers(role: WorkspaceRole | undefined): boolean {
  return role === "owner" || role === "admin";
}
