import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppLocale } from "@/i18n/AppLocaleProvider";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useAppLocale();
  const text = message ?? t("common.loadFailed");
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-4">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">{t("common.error")}</h3>
        <p className="text-sm text-muted-foreground mt-1">{text}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" /> {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
