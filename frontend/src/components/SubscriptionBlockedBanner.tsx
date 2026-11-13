import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { pathAllowsInactiveSubscription } from "@/lib/subscriptionAccess";

type BlockDetail = { code: string; message: string };

/**
 * Reage a 403 `subscription_*` do apiClient — CTA para planos sem forçar logout.
 * Se o utilizador estiver numa rota de trabalho, redirecciona uma vez para `/planos`.
 */
export function SubscriptionBlockedBanner() {
  const { t } = useAppLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const [block, setBlock] = useState<BlockDetail | null>(null);

  useEffect(() => {
    const onBlocked = (ev: Event) => {
      const detail = (ev as CustomEvent<BlockDetail>).detail;
      if (!detail?.code?.startsWith("subscription_")) return;
      setBlock({
        code: detail.code,
        message: detail.message || t("subscription.blockedFallback"),
      });
      if (
        location.pathname !== "/planos" &&
        location.pathname !== "/plans" &&
        !pathAllowsInactiveSubscription(location.pathname)
      ) {
        navigate("/planos", {
          replace: true,
          state: { subscriptionBlocked: true, code: detail.code },
        });
      }
    };
    const onLogout = () => setBlock(null);
    window.addEventListener("auth:subscription-blocked", onBlocked);
    window.addEventListener("auth:logout", onLogout);
    return () => {
      window.removeEventListener("auth:subscription-blocked", onBlocked);
      window.removeEventListener("auth:logout", onLogout);
    };
  }, [location.pathname, navigate, t]);

  if (!block) return null;

  return (
    <Alert variant="destructive" className="mx-3 mt-3 rounded-xl border md:mx-5 lg:mx-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{t("subscription.blockedTitle")}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm">{block.message}</span>
        <div className="flex shrink-0 gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link to="/planos">{t("subscription.viewPlans")}</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setBlock(null)}>
            {t("common.dismiss")}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
