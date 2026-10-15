import type { TrackingProbeResult } from "./types";

/**
 * Teste local (sem rede) da preservação de parâmetros ao construir o URL de oferta.
 * Não altera GCLID/UTM — apenas verifica se um helper de merge os mantém.
 */
export function probeTrackingParamPreservation(args: {
  offerUrl: string | null;
  mergeParams?: (url: string, params: Record<string, string>) => string;
}): TrackingProbeResult {
  const details: string[] = [];
  if (!args.offerUrl) {
    return {
      attempted: false,
      gclidPreserved: null,
      utmPreserved: null,
      msclkidPreserved: null,
      details: ["Sem URL de oferta."],
    };
  }

  const merge =
    args.mergeParams ||
    ((url, params) => {
      const u = new URL(url);
      for (const [k, v] of Object.entries(params)) {
        if (!u.searchParams.has(k)) u.searchParams.set(k, v);
      }
      return u.toString();
    });

  try {
    const sample = {
      gclid: "TeSt-GcLiD-123",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "compliance_probe",
      msclkid: "TeSt-MsClKiD-456",
    };
    const out = merge(args.offerUrl, sample);
    const parsed = new URL(out);
    const gclidPreserved = parsed.searchParams.get("gclid") === sample.gclid;
    const utmPreserved =
      parsed.searchParams.get("utm_source") === sample.utm_source &&
      parsed.searchParams.get("utm_medium") === sample.utm_medium &&
      parsed.searchParams.get("utm_campaign") === sample.utm_campaign;
    const msclkidPreserved = parsed.searchParams.get("msclkid") === sample.msclkid;
    details.push(`out_host=${parsed.hostname}`);
    if (!gclidPreserved) details.push("gclid lost");
    if (!utmPreserved) details.push("utm lost");
    if (!msclkidPreserved) details.push("msclkid lost");
    return {
      attempted: true,
      gclidPreserved,
      utmPreserved,
      msclkidPreserved,
      details,
    };
  } catch (e) {
    details.push(e instanceof Error ? e.message : "merge_failed");
    return {
      attempted: true,
      gclidPreserved: false,
      utmPreserved: false,
      msclkidPreserved: false,
      details,
    };
  }
}
