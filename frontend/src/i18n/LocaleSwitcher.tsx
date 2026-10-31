import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAppLocale } from "./AppLocaleProvider";
import { APP_LOCALE_LABELS, APP_LOCALES, type AppLocale } from "./types";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Compact header control (no label). */
  compact?: boolean;
};

export function LocaleSwitcher({ className, compact }: Props) {
  const { locale, setLocale, t } = useAppLocale();

  const select = (
    <Select value={locale} onValueChange={(v) => setLocale(v as AppLocale)}>
      <SelectTrigger
        className={cn(compact ? "h-8 w-[9.5rem] text-xs" : "h-9 w-full max-w-xs", className)}
        aria-label={t("language.switcherAria")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {APP_LOCALES.map((code) => (
          <SelectItem key={code} value={code}>
            {APP_LOCALE_LABELS[code]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (compact) return select;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor="app-locale">{t("language.label")}</Label>
      <div id="app-locale">{select}</div>
      <p className="text-[11px] text-muted-foreground leading-snug">{t("language.hint")}</p>
    </div>
  );
}
