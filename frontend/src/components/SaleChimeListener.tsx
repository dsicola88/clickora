import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "@/services/analyticsService";
import { useAuth } from "@/contexts/AuthContext";
import {
  adoptServerSaleChime,
  claimSaleChime,
  installSaleChimeUnlock,
  nextSaleChimeAction,
  playSaleChime,
  saleChimeEnabled,
} from "@/lib/saleChime";

/**
 * Com a conta aberta, uma venda aprovada nova toca o aviso.
 * A primeira leitura só regista o que já existia.
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

  const latest = useQuery({
    queryKey: ["sale-chime-latest"],
    queryFn: () => analyticsService.getConversions({ limit: 1 }),
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
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
      const data = event.data as { type?: string; id?: string } | null;
      if (!data || data.type !== "dclickora-sale-chime") return;
      if (!saleChimeEnabled()) return;
      const id = typeof data.id === "string" && data.id ? data.id : "";
      if (!id || !claimSaleChime(id)) return;
      previousId.current = id.replace(/^sale-/, "");
      primed.current = true;
      void playSaleChime();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  return null;
}
