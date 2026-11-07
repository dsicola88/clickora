import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type BlockDetail = { code: string; message: string };

/**
 * Reage a 403 `subscription_*` do apiClient — CTA para planos sem forçar logout.
 */
export function SubscriptionBlockedBanner() {
  const [block, setBlock] = useState<BlockDetail | null>(null);

  useEffect(() => {
    const onBlocked = (ev: Event) => {
      const detail = (ev as CustomEvent<BlockDetail>).detail;
      if (!detail?.code?.startsWith("subscription_")) return;
      setBlock({
        code: detail.code,
        message: detail.message || "A sua assinatura bloqueia esta acção.",
      });
    };
    const onLogout = () => setBlock(null);
    window.addEventListener("auth:subscription-blocked", onBlocked);
    window.addEventListener("auth:logout", onLogout);
    return () => {
      window.removeEventListener("auth:subscription-blocked", onBlocked);
      window.removeEventListener("auth:logout", onLogout);
    };
  }, []);

  if (!block) return null;

  return (
    <Alert variant="destructive" className="mx-3 mt-3 rounded-xl border md:mx-5 lg:mx-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Assinatura em falta ou inactiva</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm">{block.message}</span>
        <div className="flex shrink-0 gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link to="/planos">Ver planos</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setBlock(null)}>
            Dispensar
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
