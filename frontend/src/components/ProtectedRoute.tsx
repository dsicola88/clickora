import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import {
  pathAllowsInactiveSubscription,
  userHasSubscriptionAccess,
} from "@/lib/subscriptionAccess";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { t } = useAppLocale();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/auth"
        replace
        state={{ from: { pathname: location.pathname, search: location.search, hash: location.hash } }}
      />
    );
  }

  if (
    !userHasSubscriptionAccess(user) &&
    !pathAllowsInactiveSubscription(location.pathname)
  ) {
    return (
      <Navigate
        to="/planos"
        replace
        state={{ subscriptionBlocked: true, code: user.subscription_block_code ?? null }}
      />
    );
  }

  return <>{children}</>;
}
