import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { shouldPollCustomDomainSsl } from "@/lib/customDomainSslDisplay";
import { customDomainService } from "@/services/customDomainService";
import type { CustomDomainDto } from "@/types/api";

/**
 * Domínios da conta com probe go-live para SSL a provisionar.
 * Sem isto, a lista rápida fica em `ssl_provisioning` e Ads URL cai para www.dclickora.com
 * mesmo com HTTPS já a funcionar no hostname do assinante.
 */
export function useCustomDomains(opts?: { enabled?: boolean }) {
  const { user } = useAuth();
  const tenantKey = user?.id ?? "";
  const enabled = (opts?.enabled ?? true) && Boolean(tenantKey);

  return useQuery({
    queryKey: ["custom-domain", tenantKey],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<CustomDomainDto[]> => {
      const { data, error } = await customDomainService.list();
      if (error) throw new Error(error);
      const list = data ?? [];
      const needProbe = list.filter(shouldPollCustomDomainSsl).slice(0, 5);
      if (needProbe.length === 0) return list;
      const probed = await Promise.all(
        needProbe.map(async (d) => {
          try {
            const { data: live } = await customDomainService.goLive(d.id);
            return live ?? d;
          } catch {
            return d;
          }
        }),
      );
      const byId = new Map(probed.map((d) => [d.id, d]));
      return list.map((d) => byId.get(d.id) ?? d);
    },
  });
}
