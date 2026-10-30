import { getPresellUiStrings } from "@/lib/presellUiStrings";
import { cn } from "@/lib/utils";

/** Crédito da plataforma na lander pública (só quando `footer_branding === true`). */
export function PresellPlatformCredit({
  language,
  className,
}: {
  language?: string;
  className?: string;
}) {
  const L = getPresellUiStrings(language);
  return (
    <p
      data-testid="platform-footer-branding"
      className={cn(
        "px-4 pb-3 text-center text-[10px] sm:text-[11px] text-muted-foreground/80",
        className,
      )}
    >
      {L.footerBrandingPrefix}
      <a
        href="https://www.dclickora.com"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground/80"
      >
        dclickora
      </a>
      {L.footerBrandingSuffix}
    </p>
  );
}
