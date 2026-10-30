import type { PublicTenantBranding } from "@/lib/tenantBrandingPublic";
import { cn } from "@/lib/utils";

/**
 * Chrome discreto white-label (logo + nome) no rodapé da lander — não no hero.
 * Só renderiza se houver logo ou nome de marca.
 */
export function PresellTenantBrandChrome({
  branding,
  className,
}: {
  branding: PublicTenantBranding;
  className?: string;
}) {
  const name = branding.brand_name?.trim();
  const logo = branding.logo_url?.trim();
  if (!name && !logo) return null;
  return (
    <div
      data-testid="tenant-brand-chrome"
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-[11px] text-muted-foreground",
        className,
      )}
    >
      {logo ? (
        <img
          src={logo}
          alt={name || "Brand"}
          data-testid="tenant-brand-logo"
          className="h-5 w-auto max-w-[7rem] object-contain opacity-90"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      ) : null}
      {name ? <span data-testid="tenant-brand-name">{name}</span> : null}
    </div>
  );
}
