/**
 * Keep-alive: impede cold start a matar redirects com ads a gastar.
 * Em Railway: use plano always-on / sem sleep; este ping reforça o processo quente.
 */
export function registerKeepAlivePing(): void {
  const base =
    process.env.KEEP_ALIVE_URL?.trim() ||
    process.env.PUBLIC_API_URL?.trim() ||
    process.env.API_PUBLIC_URL?.trim() ||
    "";
  if (!base) {
    console.info(
      "[keep-alive] Sem KEEP_ALIVE_URL / PUBLIC_API_URL — configure always-on no Railway e um URL público para self-ping.",
    );
    return;
  }
  const url = `${base.replace(/\/+$/, "")}/api/health`;
  const ms = Math.max(60_000, Number(process.env.KEEP_ALIVE_INTERVAL_MS || 240_000) || 240_000);

  const tick = async () => {
    try {
      const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(12_000) });
      if (!res.ok) console.warn(`[keep-alive] ${url} → ${res.status}`);
    } catch (e) {
      console.warn("[keep-alive] ping falhou", e instanceof Error ? e.message : e);
    }
  };

  setInterval(() => {
    void tick();
  }, ms);
  void tick();
  console.info(`[keep-alive] self-ping a cada ${Math.round(ms / 1000)}s → ${url}`);
}
