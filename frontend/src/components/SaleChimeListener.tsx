import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "@/services/analyticsService";
import { useAuth } from "@/contexts/AuthContext";
import {
  adoptServerSaleChime,
  claimSaleChime,
  installSaleChimeUnlock,
  nextSaleChimeAction,
  playSaleChime,
  resolvePushChimeSound,
  saleChimeEnabled,
  saleChimeId,
} from "@/lib/saleChime";
import { clearPendingPushChime, readPendingPushChime } from "@/lib/saleChimePushPending";

type PushChimePayload = { id?: string; sound?: string };

/**
 * Com a conta aberta, uma venda aprovada nova toca o aviso.
 * Push (telefone) dispara o mesmo som escolhido nas definições.
 */
export function SaleChimeListener() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(() => saleChimeEnabled());
  const primed = useRef(false);
  const previousId = useRef<string | null>(null);

  useEffect(() => installSaleChimeUnlock(), []);

  useEffect(() => {
    adoptServerSaleChime(user?.sale_chime);
  }, [user?.sale_chime]);

  useEffect(() => {
    const sync = () => setEnabled(saleChimeEnabled());
    window.addEventListener("dclickora-sale-chime-pref", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("dclickora-sale-chime-pref", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const handlePushChime = useCallback(async (payload: PushChimePayload) => {
    if (!saleChimeEnabled()) return;
    const rawId = (payload.id || "").trim();
    const id = rawId || `push-${Date.now()}`;
    if (!claimSaleChime(id)) {
      await clearPendingPushChime();
      return;
    }
    previousId.current = saleChimeId(id);
    primed.current = true;
    const sound = resolvePushChimeSound(payload.sound);
    const ok = await playSaleChime(sound);
    if (ok) await clearPendingPushChime();
  }, []);

  const tryConsumePendingPushChime = useCallback(async () => {
    const pending = await readPendingPushChime();
    if (!pending) return;
    await handlePushChime({ id: pending.id, sound: pending.sound });
  }, [handlePushChime]);

  useEffect(() => {
    void tryConsumePendingPushChime();
    const onVisible = () => {
      if (document.visibilityState === "visible") void tryConsumePendingPushChime();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [tryConsumePendingPushChime]);

  const latest = useQuery({
    queryKey: ["sale-chime-latest"],
    queryFn: () => analyticsService.getConversions({ limit: 1 }),
    refetchInterval: enabled ? 15_000 : false,
    refetchIntervalInBackground: enabled,
  });

  useEffect(() => {
    const row = latest.data?.[0];
    const action = nextSaleChimeAction({
      primed: primed.current,
      previousId: previousId.current,
      nextId: row?.id ?? null,
      createdAt: row?.created_at ?? null,
      nowMs: Date.now(),
      enabled,
    });
    primed.current = action.primed;
    previousId.current = action.previousId;
    if (action.play && action.previousId && claimSaleChime(action.previousId)) {
      void playSaleChime();
    }
  }, [latest.data, enabled]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; id?: string; sound?: string } | null;
      if (!data || data.type !== "dclickora-sale-chime") return;
      void handlePushChime({ id: data.id, sound: data.sound });
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    void navigator.serviceWorker.ready.then(() => tryConsumePendingPushChime());
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [handlePushChime, tryConsumePendingPushChime]);

  return null;
}
