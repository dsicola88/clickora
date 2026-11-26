import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Check } from "lucide-react";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PRESELL_COOKIE_STYLE,
  PRESELL_COOKIE_STYLE_ORDER,
  getPresellCookieStyle,
  isPresellCookieStyleId,
  type PresellCookieStyleId,
  type PresellCookieStyleTokens,
} from "@/lib/presellCookieBannerStyles";

type NameKey = `pages.cookieBannerStyle.${PresellCookieStyleId}Name`;
type DescKey = `pages.cookieBannerStyle.${PresellCookieStyleId}Desc`;

/** Miniatura fiel do layout (barra / canto / central) com as cores reais do estilo. */
function StylePreview({ tokens }: { tokens: PresellCookieStyleTokens }) {
  const btn = (bg: string) => (
    <span className="block h-1.5 w-4 rounded-[2px]" style={{ background: bg }} aria-hidden />
  );
  const lines = (
    <span className="flex min-w-0 flex-1 flex-col gap-[2px]" aria-hidden>
      <span className="block h-[3px] w-1/2 rounded-full" style={{ background: tokens.title }} />
      <span className="block h-[2px] w-full rounded-full opacity-70" style={{ background: tokens.body }} />
    </span>
  );
  const box = (extra: string) => (
    <span
      className={cn("absolute flex items-center gap-1.5 border p-1.5", extra)}
      style={{
        background: tokens.surface,
        borderColor: tokens.surfaceBorder,
        boxShadow: tokens.shadow,
        backdropFilter: tokens.blurPx > 0 ? `blur(${tokens.blurPx}px)` : undefined,
      }}
      aria-hidden
    >
      {lines}
      <span className="flex shrink-0 gap-1">
        {btn(tokens.allowBg)}
        {btn(tokens.closeBg)}
      </span>
    </span>
  );
  return (
    <span
      className="relative block h-16 w-full overflow-hidden rounded-md border border-border bg-gradient-to-b from-slate-100 to-slate-200"
      aria-hidden
    >
      <span className="absolute left-2 top-2 block h-1.5 w-1/2 rounded-full bg-slate-300" />
      <span className="absolute left-2 top-5 block h-1 w-2/3 rounded-full bg-slate-300/80" />
      <span className="absolute left-2 top-7 block h-1 w-1/3 rounded-full bg-slate-300/80" />
      {tokens.layout === "bar" ? box("inset-x-0 bottom-0 border-x-0 border-b-0") : null}
      {tokens.layout === "corner" ? box("bottom-1.5 right-1.5 w-[58%] rounded-md") : null}
      {tokens.layout === "floating" ? box("bottom-1.5 left-1/2 w-[72%] -translate-x-1/2 rounded-md") : null}
    </span>
  );
}

/**
 * Seletor das predefinições do banner do tipo «cookies».
 * Valor inválido/ausente = `classicBar` (mostrado como selecionado).
 */
export function CookieBannerStylePicker({
  value,
  onChange,
  idPrefix = "cookie-style",
  className,
}: {
  value: string | null | undefined;
  onChange: (id: PresellCookieStyleId) => void;
  idPrefix?: string;
  className?: string;
}) {
  const { t } = useAppLocale();
  const current: PresellCookieStyleId = isPresellCookieStyleId(value) ? value : DEFAULT_PRESELL_COOKIE_STYLE;
  return (
    <div className={cn("space-y-2", className)} data-testid="cookie-style-picker">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground" id={`${idPrefix}-label`}>
          {t("pages.cookieBannerStyle.title")}
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t("pages.cookieBannerStyle.hint")}</p>
      </div>
      <RadioGroupPrimitive.Root
        value={current}
        onValueChange={(v) => {
          if (isPresellCookieStyleId(v)) onChange(v);
        }}
        aria-labelledby={`${idPrefix}-label`}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
      >
        {PRESELL_COOKIE_STYLE_ORDER.map((id) => {
          const tokens = getPresellCookieStyle(id);
          const selected = current === id;
          return (
            <RadioGroupPrimitive.Item
              key={id}
              value={id}
              id={`${idPrefix}-${id}`}
              data-testid={`cookie-style-option-${id}`}
              className={cn(
                "group flex cursor-pointer flex-col gap-2 rounded-lg border bg-card p-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected ? "border-primary ring-1 ring-primary" : "border-border hover:border-muted-foreground/50",
              )}
            >
              <StylePreview tokens={tokens} />
              <span className="flex items-start justify-between gap-2 px-0.5">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
                    {t(`pages.cookieBannerStyle.${id}Name` as NameKey)}
                    {id === DEFAULT_PRESELL_COOKIE_STYLE ? (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {t("pages.cookieBannerStyle.recommended")}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {t(`pages.cookieBannerStyle.${id}Desc` as DescKey)}
                  </span>
                </span>
                {selected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
              </span>
            </RadioGroupPrimitive.Item>
          );
        })}
      </RadioGroupPrimitive.Root>
    </div>
  );
}
