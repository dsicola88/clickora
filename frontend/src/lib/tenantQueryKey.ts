import type { User } from "@/types/api";

/** Chave estável para cache React Query dos dados da conta (presells, rotadores, etc.). */
export function tenantQueryKey(user: User | null | undefined): string {
  return user?.tenant_user_id ?? user?.id ?? "";
}
