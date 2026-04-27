import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";

import { useAuth } from "@/providers/AuthProvider";
import { useClickoraEmbed } from "@/hooks/useClickoraEmbed";
import { exchangeClickoraSso } from "@/server/auth.functions";

const MSG_TYPE = "clickora:sso";

function getTrustedClickoraOrigin(): string | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("clickora_parent");
  if (q) {
    try {
      return new URL(q).origin;
    } catch {
      return null;
    }
  }
  const env = import.meta.env.VITE_CLICKORA_APP_URL?.trim();
  if (env) {
    try {
      return new URL(env).origin;
    } catch {
      return null;
    }
  }
  return null;
}

function isSsoPayload(data: unknown): data is { type: string; token: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === MSG_TYPE &&
    typeof (data as { token?: unknown }).token === "string"
  );
}

/**
 * Recebe o JWT do parent Clickora via postMessage e troca por cookie de sessão local.
 */
export function ClickoraSsoBridge() {
  const embed = useClickoraEmbed();
  const { refresh } = useAuth();
  const exchange = useServerFn(exchangeClickoraSso);
  const busy = useRef(false);

  useEffect(() => {
    if (!embed) return;
    const trusted = getTrustedClickoraOrigin();
    if (!trusted) return;

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== trusted) return;
      if (!isSsoPayload(e.data)) return;
      if (busy.current) return;
      busy.current = true;
      void (async () => {
        try {
          const res = await exchange({ data: { token: e.data.token } });
          if (res.ok) await refresh();
        } catch (err) {
          console.error("[ClickoraSsoBridge]", err);
        } finally {
          busy.current = false;
        }
      })();
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embed, exchange, refresh]);

  return null;
}
