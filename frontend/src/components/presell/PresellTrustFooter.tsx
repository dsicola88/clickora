import { cn } from "@/lib/utils";
import { SITE_SUPPORT_EMAIL } from "@/lib/siteLegal";
import { getPresellUiStrings, isRtlLocale, type PresellLocaleKey } from "@/lib/presellUiStrings";

type Props = {
  language: string | undefined;
  tone?: "light" | "dark" | "slate";
  className?: string;
  /** URL de política de cookies da conta, se existir. */
  cookiePolicyUrl?: string;
};

/**
 * Rodapé de transparência para o Google Ads: quem opera a página, políticas e contacto.
 * Não clona a marca do produto nem inventa “site oficial”.
 */
export function PresellTrustFooter({ language, tone = "light", className, cookiePolicyUrl }: Props) {
  const s = getPresellUiStrings(language);
  const locale = (language || "en") as PresellLocaleKey;
  const rtl = isRtlLocale(locale);
  const privacyHref = "/privacidade";
  const termsHref = "/termos";
  const cookieHref = cookiePolicyUrl?.trim() || privacyHref;
  const mail = `mailto:${SITE_SUPPORT_EMAIL}`;

  const text =
    tone === "dark" ? "text-slate-400" : tone === "slate" ? "text-slate-600" : "text-muted-foreground";
  const link =
    tone === "dark"
      ? "text-slate-200 underline-offset-2 hover:underline"
      : tone === "slate"
        ? "text-slate-800 underline-offset-2 hover:underline"
        : "text-foreground/85 underline-offset-2 hover:underline";
  const border =
    tone === "dark" ? "border-white/10" : tone === "slate" ? "border-slate-200/80" : "border-border/40";

  return (
    <footer
      className={cn("w-full max-w-3xl mx-auto px-3 sm:px-4 pb-10 pt-2", className)}
      dir={rtl ? "rtl" : "ltr"}
    >
      <div className={cn("rounded-2xl border px-4 py-5 sm:px-6 sm:py-6 space-y-3 text-left", border)}>
        <p className={cn("text-xs sm:text-sm leading-relaxed", text)}>{s.trustDisclosure}</p>
        <p className={cn("text-xs sm:text-sm leading-relaxed", text)}>{s.trustAbout}</p>
        <nav
          className={cn("flex flex-wrap gap-x-4 gap-y-2 text-xs sm:text-sm font-medium pt-1", text)}
          aria-label={s.trustNavLabel}
        >
          <a href={privacyHref} target="_blank" rel="noopener noreferrer" className={link}>
            {s.trustPrivacy}
          </a>
          <a href={termsHref} target="_blank" rel="noopener noreferrer" className={link}>
            {s.trustTerms}
          </a>
          <a href={cookieHref} target="_blank" rel="noopener noreferrer" className={link}>
            {s.cookiePolicy}
          </a>
          <a href={mail} className={link}>
            {s.trustContact}
          </a>
        </nav>
        <p className={cn("text-[11px] leading-relaxed", text)}>
          {s.trustContactLine}{" "}
          <a href={mail} className={cn("font-medium", link)}>
            {SITE_SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </footer>
  );
}
