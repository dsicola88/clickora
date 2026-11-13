import type { User } from "@/types/api";

/** Rotas da app onde assinatura inactiva ainda pode entrar (conta / ajuda / admin). */
const SUBSCRIPTION_BYPASS_PREFIXES = ["/conta", "/ajuda", "/admin"] as const;

/**
 * Acesso ao painel com assinatura activa.
 * Se o campo ainda não veio do `/auth/me` (clientes antigos em cache), não bloqueia
 * de forma proactiva — o banner de 403 continua a cobrir.
 */
export function userHasSubscriptionAccess(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "admin" || user.role === "super_admin") return true;
  if (typeof user.subscription_allowed === "boolean") return user.subscription_allowed;
  return true;
}

export function pathAllowsInactiveSubscription(pathname: string): boolean {
  return SUBSCRIPTION_BYPASS_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
