import { cn } from "@/lib/utils";
import { SITE_SUPPORT_EMAIL } from "@/lib/siteLegal";
import { presellComplianceLanguage } from "@/lib/presellPublicComplianceCopy";
import { getPresellUiStrings, isRtlLocale, type PresellLocaleKey } from "@/lib/presellUiStrings";
import { getPortalChromeCopy } from "@/lib/presellPortalCopy";
import type { ImportedPolicyUrls } from "@/lib/presellGenerationNiche";
import {
  merchantFooterCopy,
  merchantLinkLabel,
} from "@/lib/presellMerchantFooterCopy";
import {
  merchantPolicyLinks,
  resolvePresellFooterPolicies,
  type PresellFooterPolicyBundle,
} from "@/lib/presellFooterPolicies";

type Props = {
  language: string | undefined;
  tone?: "light" | "dark" | "slate" | "portal";
  className?: string;
  /** @deprecated Prefer `settings` + `contentPolicyUrls`. */
  cookiePolicyUrl?: string;
  privacyPolicyUrl?: string;
  termsUrl?: string;
  settings?: Record<string, unknown>;
  contentPolicyUrls?: ImportedPolicyUrls | null;
  policies?: PresellFooterPolicyBundle;
  businessName?: string;
  productName?: string;
  portalMode?: boolean;
  operatorDocument?: string;
  supportEmail?: string;
};

function resolveBundle(props: Props): PresellFooterPolicyBundle {
  if (props.policies) return props.policies;
  const legacy: Record<string, unknown> = { ...(props.settings ?? {}) };
  if (props.privacyPolicyUrl) legacy.privacyPolicyUrl = props.privacyPolicyUrl;
  if (props.cookiePolicyUrl) legacy.cookiePolicyUrl = props.cookiePolicyUrl;
  if (props.termsUrl) legacy.termsUrl = props.termsUrl;
  return resolvePresellFooterPolicies(legacy, props.contentPolicyUrls);
}

function MerchantPolicyNav({
  bundle,
  locale,
  linkClass,
  textClass,
}: {
  bundle: PresellFooterPolicyBundle;
  locale: PresellLocaleKey;
  linkClass: string;
  textClass: string;
}) {
  const links = merchantPolicyLinks(bundle);
  if (links.length === 0) return null;
  const copy = merchantFooterCopy(locale);
  return (
    <div className={cn("space-y-2 pt-2 border-t border-dashed", textClass)}>
      <p className={cn("text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80")}>{copy.section}</p>
      <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs sm:text-sm font-medium">
        {links.map(({ id, href }) => (
          <a
            key={id}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {merchantLinkLabel(locale, id as "merchantPrivacy" | "merchantTerms" | "merchantRefund" | "merchantShipping")}
          </a>
        ))}
      </nav>
    </div>
  );
}

/**
 * Rodapé Ads-safe: políticas desta página (afiliado) na mesma origem;
 * links do comerciante só com rótulo explícito (consulta antes de comprar).
 */
export function PresellTrustFooter({
  language,
  tone = "light",
  className,
  settings,
  contentPolicyUrls,
  policies,
  cookiePolicyUrl,
  privacyPolicyUrl,
  termsUrl,
  businessName,
  productName: _productName,
  portalMode = false,
  operatorDocument,
  supportEmail,
}: Props) {
  const locale = presellComplianceLanguage(language);
  const s = getPresellUiStrings(locale);
  const portal = getPortalChromeCopy(locale);
  const copy = merchantFooterCopy(locale);
  const rtl = isRtlLocale(locale);
  const bundle = resolveBundle({
    language,
    settings,
    contentPolicyUrls,
    policies,
    cookiePolicyUrl,
    privacyPolicyUrl,
    termsUrl,
  });
  const { operator } = bundle;
  const medicalHref = operator.medical;
  const email = (supportEmail || "").trim();
  const contactEmail = email || SITE_SUPPORT_EMAIL;
  const mail = `mailto:${contactEmail}`;
  const doc = (operatorDocument || "").trim();
  const operatorName = (businessName || "").trim();
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
            {operatorName ? ` ${operatorName}` : ` ${portal.independentPage}`} — {portal.rights}
          </p>
          <p>
            <span className="font-semibold text-slate-100">{portal.affiliateTitle}</span> {portal.affiliateBody}
          </p>
          <p className="text-slate-300 text-xs leading-relaxed">{portal.disclaimer}</p>
          {(operatorName || doc || email) && (
            <p className="text-slate-300">
              {operatorName ? (
                <span>
                  {portal.operator} {operatorName}.{" "}
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
          {!operatorName && !doc && !email ? (
            <p className="text-slate-300">
              {portal.platformContact}{" "}
              <a href={mail} className="underline underline-offset-2 hover:text-white">
                {contactEmail}
              </a>
              .
            </p>
          ) : null}
          <nav
            className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs font-medium text-slate-300"
            aria-label={portal.policies}
          >
            <a href={operator.privacy} target="_blank" rel="noopener noreferrer" className="hover:text-white underline-offset-2 hover:underline">
              {copy.operatorPrivacy}
            </a>
            <a href={operator.terms} target="_blank" rel="noopener noreferrer" className="hover:text-white underline-offset-2 hover:underline">
              {copy.operatorTerms}
            </a>
            <a href={medicalHref} target="_blank" rel="noopener noreferrer" className="hover:text-white underline-offset-2 hover:underline">
              {portal.medical}
            </a>
            <a href={operator.cookies} target="_blank" rel="noopener noreferrer" className="hover:text-white underline-offset-2 hover:underline">
              {s.cookiePolicy}
            </a>
          </nav>
          <MerchantPolicyNav
            bundle={bundle}
            locale={locale}
            linkClass="hover:text-white underline-offset-2 hover:underline text-slate-300"
            textClass="border-white/15 text-slate-400"
          />
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
          <a href={operator.privacy} target="_blank" rel="noopener noreferrer" className={link}>
            {copy.operatorPrivacy}
          </a>
          <a href={operator.terms} target="_blank" rel="noopener noreferrer" className={link}>
            {copy.operatorTerms}
          </a>
          <a href={operator.cookies} target="_blank" rel="noopener noreferrer" className={link}>
            {s.cookiePolicy}
          </a>
          <a href={medicalHref} target="_blank" rel="noopener noreferrer" className={link}>
            {portal.medical}
          </a>
          <a href={mail} className={link}>
            {s.trustContact}
          </a>
        </nav>
        <MerchantPolicyNav bundle={bundle} locale={locale} linkClass={link} textClass={cn("border-border/50", text)} />
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
