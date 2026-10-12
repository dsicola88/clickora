import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const BUILT_RELEASE = import.meta.env.VITE_APP_RELEASE || "dev";

/**
 * Compara a versão gravada neste ecrã com /version.json do deploy actual.
 * Quem tem a app aberta, ou volta a ela, vê o aviso. Não envia e-mail.
 */
export function AppUpdateNotice() {
  const [remote, setRemote] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { release?: unknown };
        if (!stop && typeof data.release === "string" && data.release.trim()) {
          setRemote(data.release.trim());
        }
      } catch {
        /* sem rede: o aviso fica para a próxima visita */
      }
    };
    void check();
    const timer = window.setInterval(check, 120_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!remote || remote === "dev" || remote === BUILT_RELEASE) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm">
      <p className="min-w-0 leading-snug text-foreground">Há uma actualização nova da dclickora.</p>
      <Button size="sm" className="h-8 shrink-0 gap-1.5" onClick={() => window.location.reload()}>
        <RefreshCw className="h-3.5 w-3.5" />
        Actualizar
      </Button>
    </div>
  );
}
