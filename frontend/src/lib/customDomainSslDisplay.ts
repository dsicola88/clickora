import type { CustomDomainDto } from "@/types/api";

export type SslBadgeTone = "muted" | "amber" | "emerald" | "rose";

export function resolveSslBadge(d: Pick<CustomDomainDto, "status" | "ssl_state" | "https_ready" | "ssl_label" | "vercel_domain_registered">): {
  label: string;
  tone: SslBadgeTone;
  poll: boolean;
} | null {
  const state = d.ssl_state;
  if (!state || state === "pending_dns") return null;
  if (state === "https_ready" || d.https_ready) {
    return { label: d.ssl_label || "HTTPS pronto", tone: "emerald", poll: false };
  }
  if (state === "misconfigured") {
    return { label: d.ssl_label || "DNS mal configurado", tone: "rose", poll: true };
  }
  if (state === "ssl_provisioning") {
    return { label: d.ssl_label || "SSL a provisionar", tone: "amber", poll: true };
  }
  if (state === "dns_verified") {
    return { label: d.ssl_label || "DNS verificado", tone: "emerald", poll: false };
  }
  return null;
}

export function shouldPollCustomDomainSsl(d: Pick<CustomDomainDto, "status" | "ssl_state" | "https_ready" | "vercel_domain_registered">): boolean {
  if (d.status !== "verified") return false;
  if (d.https_ready) return false;
  if (d.ssl_state === "https_ready" || d.ssl_state === "dns_verified") return false;
  return d.vercel_domain_registered === true || d.ssl_state === "ssl_provisioning" || d.ssl_state === "misconfigured";
}
