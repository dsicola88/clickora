import { cn } from "@/lib/utils";
import { SITE_SUPPORT_EMAIL } from "@/lib/siteLegal";
import { getPresellUiStrings, isRtlLocale, type PresellLocaleKey } from "@/lib/presellUiStrings";

type Props = {
  language: string | undefined;
  tone?: "light" | "dark" | "slate" | "portal";
  className?: string;
  /** URL de política de cookies da conta, se existir. */
  cookiePolicyUrl?: string;
  /** Nome do produto / portal (rodapé editorial). */
  productName?: string;
  /** Rodapé completo estilo portal informativo (PT). */
  portalMode?: boolean;
  /** CNPJ/CPF do operador — placeholder se vazio. */
  operatorDocument?: string;
  supportEmail?: string;
};

/**
 * Rodapé de transparência: afiliado, políticas e contacto.
 * Em portalMode: bloco cinza escuro completo (exigência Ads / portal de saúde).
 */
export function PresellTrustFooter({
  language,
  tone = "light",
  className,
  cookiePolicyUrl,
  productName,
  portalMode = false,
  operatorDocument,
  supportEmail,
}: Props) {
  const s = getPresellUiStrings(language);
  const locale = (language || "pt-BR") as PresellLocaleKey;
  const rtl = isRtlLocale(locale);
  const privacyHref = "/privacidade";
  const termsHref = "/termos";
  const cookieHref = cookiePolicyUrl?.trim() || privacyHref;
  const medicalHref = "/aviso-medico";
  const email = (supportEmail || "").trim() || SITE_SUPPORT_EMAIL;
  const mail = `mailto:${email}`;
  const doc = (operatorDocument || "").trim() || "[Insira Seu Documento Aqui]";
  const brand = (productName || "Informativo").trim();
  const year = new Date().getFullYear();

  if (portalMode || tone === "portal") {
    return (
      <footer
        className={cn("w-full bg-slate-800 text-slate-200", className)}
        dir={rtl ? "rtl" : "ltr"}
      >
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 text-sm leading-relaxed sm:px-6">
          <p className="font-medium text-slate-100">
            © {year} {brand} Informativo — Todos os direitos reservados.
          </p>
          <p>
            <span className="font-semibold text-slate-100">Aviso de Afiliado:</span> Este site atua
            de forma independente como um portal de conteúdo e análises informativas. Ao clicar nos
            links e visitar o site do fabricante, nós poderemos receber uma comissão por indicação
            caso uma compra seja efetuada.
          </p>
          <p className="text-slate-300">
            CNPJ/CPF: {doc} | E-mail:{" "}
            <a href={mail} className="underline underline-offset-2 hover:text-white">
              {email}
            </a>
          </p>
          <nav
            className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs font-medium text-slate-300"
            aria-label="Políticas"
          >
            <a href={privacyHref} target="_blank" rel="noopener noreferrer" className="hover:text-white underline-offset-2 hover:underline">
              Política de Privacidade
            </a>
            <a href={termsHref} target="_blank" rel="noopener noreferrer" className="hover:text-white underline-offset-2 hover:underline">
              Termos de Uso
            </a>
            <a href={medicalHref} target="_blank" rel="noopener noreferrer" className="hover:text-white underline-offset-2 hover:underline">
              Aviso de Isenção Médica
            </a>
            <a href={cookieHref} target="_blank" rel="noopener noreferrer" className="hover:text-white underline-offset-2 hover:underline">
              Política de Cookies
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
          <a href={mail} className={link}>
            {s.trustContact}
          </a>
        </nav>
        <p className={cn("text-[11px] leading-relaxed", text)}>
          {s.trustContactLine}{" "}
          <a href={mail} className={cn("font-medium", link)}>
            {email}
          </a>
        </p>
      </div>
    </footer>
  );
}
