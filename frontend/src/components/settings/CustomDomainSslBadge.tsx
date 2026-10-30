import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { customDomainService } from "@/services/customDomainService";
import type { CustomDomainDto } from "@/types/api";
import { resolveSslBadge, shouldPollCustomDomainSsl } from "@/lib/customDomainSslDisplay";
import { cn } from "@/lib/utils";

const toneClass: Record<string, string> = {
  muted: "bg-muted text-muted-foreground",
  amber: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  rose: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

/**
 * Badge SSL/go-live + poll enquanto a provisionar (após DNS verificado na Vercel).
 */
export function CustomDomainSslBadge({
  domain,
  tenantKey,
}: {
  domain: CustomDomainDto;
  tenantKey: string;
}) {
  const qc = useQueryClient();
  const poll = shouldPollCustomDomainSsl(domain);

  const { data: live, isFetching } = useQuery({
    queryKey: ["custom-domain-go-live", tenantKey, domain.id],
    queryFn: async () => {
      const { data, error } = await customDomainService.goLive(domain.id);
      if (error) throw new Error(error);
      return data!;
    },
    enabled: poll,
    refetchInterval: (q) => {
      const d = q.state.data ?? domain;
      return shouldPollCustomDomainSsl(d) ? 12_000 : false;
    },
    staleTime: 8_000,
  });

  useEffect(() => {
    if (!live) return;
    qc.setQueryData<CustomDomainDto[]>(["custom-domain", tenantKey], (old) =>
      (old ?? []).map((x) => (x.id === live.id ? { ...x, ...live } : x)),
    );
  }, [live, qc, tenantKey]);

  const merged: CustomDomainDto = live ? { ...domain, ...live } : domain;
  const badge = resolveSslBadge(merged);
  if (!badge) return null;

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", toneClass[badge.tone])}>
      {(poll || isFetching) && badge.poll ? <Loader2 className="h-3 w-3 animate-spin shrink-0" /> : null}
      {badge.label}
    </span>
  );
}
