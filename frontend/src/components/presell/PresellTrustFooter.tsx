import { cn } from "@/lib/utils";
import { SITE_SUPPORT_EMAIL } from "@/lib/siteLegal";
import { getPresellUiStrings, isRtlLocale, type PresellLocaleKey } from "@/lib/presellUiStrings";
import { getPortalChromeCopy } from "@/lib/presellPortalCopy";

type Props = {
  language: string | undefined;
  tone?: "light" | "dark" | "slate" | "portal";
  className?: string;
  cookiePolicyUrl?: string;
  privacyPolicyUrl?: string;
  termsUrl?: string;
  /** Nome do operador (não o da marca do produto). */
  businessName?: string;
  productName?: string;
  portalMode?: boolean;
  /** CNPJ/CPF/NIF real — omitido se vazio (nunca placeholder). */
  operatorDocument?: string;
  supportEmail?: string;
};

function realUrl(raw: string | undefined, fallback: string): string {
  const t = (raw || "").trim();
  if (!t || t === "#" || /insira|exemplo|example\.com|seu-dominio|placeholder/i.test(t)) {
    return fallback;
  }
  return t;
}

/**
 * Rodapé Ads-safe: só dados reais. Sem CNPJ fictício, sem e-mail inventado,
 * sem se apresentar como a marca do produto.
 */
export function PresellTrustFooter({
  language,
  tone = "light",
  className,
  cookiePolicyUrl,
  privacyPolicyUrl,
  termsUrl,
  businessName,
  productName: _productName,
  portalMode = false,
  operatorDocument,
  supportEmail,
}: Props) {
  const s = getPresellUiStrings(language);
  const portal = getPortalChromeCopy(language);
  const locale = (language || "pt-BR") as PresellLocaleKey;
  const rtl = isRtlLocale(locale);
  const privacyHref = realUrl(privacyPolicyUrl, "/privacidade");
  const termsHref = realUrl(termsUrl, "/termos");
  const cookieHref = realUrl(cookiePolicyUrl, privacyHref);
  const medicalHref = "/aviso-medico";
  const email = (supportEmail || "").trim();
  const contactEmail = email || SITE_SUPPORT_EMAIL;
  const mail = `mailto:${contactEmail}`;
  const doc = (operatorDocument || "").trim();
  const operator = (businessName || "").trim();
  const year = new Date().getFullYear();

  if (portalMode || tone === "portal") {
    return (
      <footer
        className={cn("w-full bg-slate-800 text-slate-200", className)}
        dir={rtl ? "rtl" : "ltr"}
      >
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 text-sm leading-relaxed sm:px-6">
          <p className="font-medium text-slate-100">
            © {year}
            {operator ? ` ${operator}` : ` ${portal.independentPage}`} — {portal.rights}
          </p>
          <p>
            <span className="font-semibold text-slate-100">{portal.affiliateTitle}</span> {portal.affiliateBody}
          </p>
          <p className="text-slate-300 text-xs leading-relaxed">{portal.disclaimer}</p>
          {(operator || doc || email) && (
            <p className="text-slate-300">
              {operator ? (
                <span>
                  {portal.operator} {operator}.{" "}
                </span>
              ) : null}
              {doc ? (
                <span>
                  {portal.document} {doc}.{" "}
                </span>
              ) : null}
              {portal.contact}{" "}
              <a href={mail} className="underline underline-offset-2 hover:text-white">
                {contactEmail}
              </a>
            </p>
          )}
          {!operator && !doc && !email ? (
            <p className="text-slate-300">
              {portal.platformContact}{" "}
              <a href={mail} className="underline underline-offset-2 hover:text-white">
                {contactEmail}
              </a>
              . {portal.completeOperator}
            </p>
          ) : null}
          <nav
            className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs font-medium text-slate-300"
            aria-label={portal.policies}
          >
            <a
              href={privacyHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white underline-offset-2 hover:underline"
            >
              {s.trustPrivacy}
            </a>
            <a
              href={termsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white underline-offset-2 hover:underline"
            >
              {s.trustTerms}
            </a>
            <a
              href={medicalHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white underline-offset-2 hover:underline"
            >
              {portal.medical}
            </a>
            <a
              href={cookieHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white underline-offset-2 hover:underline"
            >
              {s.cookiePolicy}
            </a>
          </nav>
        </div>
      </footer>
    );
  }

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
      <div
        className={cn(
          "rounded-2xl border px-4 py-5 sm:px-6 sm:py-6 space-y-3 text-left shadow-sm",
          border,
          tone === "dark" ? "bg-white/[0.03]" : tone === "slate" ? "bg-slate-50/80" : "bg-muted/20",
        )}
      >
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.16em]",
            tone === "dark" ? "text-slate-500" : "text-muted-foreground/80",
          )}
        >
          {s.trustNavLabel}
        </p>
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
          <a href={medicalHref} target="_blank" rel="noopener noreferrer" className={link}>
            {portal.medical}
          </a>
          <a href={mail} className={link}>
            {s.trustContact}
          </a>
        </nav>
        <p className={cn("text-[11px] leading-relaxed", text)}>
          {s.trustContactLine}{" "}
          <a href={mail} className={cn("font-medium", link)}>
            {contactEmail}
          </a>
        </p>
      </div>
    </footer>
  );
}
