/**
 * Re-sincronizar conta Google (Integrações → projecto) com timeout e fases claras.
 * Evita o hang silencioso de 60s+ sem feedback.
 */
import { toast } from "sonner";
import { toastGoogleAdsError } from "@/lib/paidAdsUi";
import { paidAdsService } from "@/services/paidAdsService";

const DEFAULT_TIMEOUT_MS = 90_000;

export type GoogleAdsSyncResult =
  | {
      ok: true;
      customer_id?: string;
      imported?: number;
    }
  | { ok: false; error: string; timedOut?: boolean };

export async function syncGoogleAdsFromIntegrations(
  projectId: string,
  opts?: {
    timeoutMs?: number;
    /** toast id estável para actualizar a mesma notificação */
    toastId?: string | number;
    /** Sem toasts (ex.: sync automático ao abrir Configurações). */
    silent?: boolean;
  },
): Promise<GoogleAdsSyncResult> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const toastId = opts?.toastId ?? `google-sync-${projectId}`;
  const silent = Boolean(opts?.silent);

  if (!silent) {
    toast.loading("A sincronizar conta Google…", {
      id: toastId,
      description: "Ligar token e importar campanhas Search (pode demorar até ~90s).",
    });
  }

  let timer: number | undefined;
  const timeoutPromise = new Promise<{ data: null; error: string; timedOut: true }>((resolve) => {
    timer = window.setTimeout(() => {
      resolve({
        data: null,
        timedOut: true,
        error: `A sincronização ultrapassou ${Math.round(timeoutMs / 1000)}s. A Google pode ainda estar a responder — aguarde e actualize a página, ou tente de novo.`,
      });
    }, timeoutMs);
  });

  const raced = await Promise.race([
    paidAdsService.googleLinkFromIntegrations(projectId, { import_campaigns: true }).then((r) => ({
      ...r,
      timedOut: false as const,
    })),
    timeoutPromise,
  ]);

  if (timer != null) window.clearTimeout(timer);

  const timedOut = Boolean(raced.timedOut);
  const data = "data" in raced ? raced.data : null;
  const error = "error" in raced ? raced.error : null;

  if (error || !data) {
    const msg = toastGoogleAdsError(error) || error || "Falha ao sincronizar.";
    if (!silent) {
      toast.error(timedOut ? "Sincronização demorou demais" : "Sincronização falhou", {
        id: toastId,
        description: msg,
        duration: 12_000,
      });
    }
    return { ok: false, error: msg, timedOut };
  }

  const imported = data.import?.imported;
  const desc =
    imported != null
      ? `Conta ${data.customer_id ?? "OK"} · ${imported} campanha(s) importada(s)`
      : `Conta ${data.customer_id ?? "OK"} sincronizada`;

  if (!silent) {
    toast.success("Sincronização concluída", {
      id: toastId,
      description: desc,
      duration: 6_000,
    });
  }

  return {
    ok: true,
    customer_id: data.customer_id,
    imported: typeof imported === "number" ? imported : undefined,
  };
}
