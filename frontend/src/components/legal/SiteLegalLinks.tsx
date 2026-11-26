import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { usePublicSupportContacts } from "@/hooks/usePublicSupportContacts";
import { supportMailto } from "@/lib/siteLegal";

export type SiteLegalLink = { label: string; href: string };

/** Sempre presentes no rodapé do site institucional (exigência de transparência das redes de anúncios). */
export const REQUIRED_SITE_LEGAL_LINKS: readonly SiteLegalLink[] = [
  { label: "Planos e preços", href: "/planos" },
  { label: "Termos de uso", href: "/termos" },
  { label: "Privacidade", href: "/privacidade" },
];

const HREF_ALIASES: Record<string, string> = { "/plans": "/planos" };

function normalizeHref(href: string): string {
  const h = href.trim().split(/[?#]/)[0]?.replace(/\/+$/, "").toLowerCase() || "/";
  return HREF_ALIASES[h] ?? h;
}

/** Links do admin + os obrigatórios que faltarem (sem duplicar). */
export function withRequiredSiteLegalLinks(links: readonly SiteLegalLink[] | null | undefined): SiteLegalLink[] {
  const out = [...(links ?? [])].filter((l) => l?.href?.trim() && l?.label?.trim());
  const present = new Set(out.map((l) => normalizeHref(l.href)));
  for (const req of REQUIRED_SITE_LEGAL_LINKS) {
    if (!present.has(normalizeHref(req.href))) out.push({ ...req });
  }
  return out;
}

/** Link de contacto por e-mail configurado pelo superadmin (Admin → Marca). */
export function useSiteContactLink(): SiteLegalLink | null {
  const { data } = usePublicSupportContacts();
  const mailto = supportMailto(data?.support_email);
  return mailto && data?.support_email ? { label: `Contacto: ${data.support_email}`, href: mailto } : null;
}

/** Rodapé legal mínimo das páginas institucionais sem rodapé próprio. */
export function SiteLegalLinks({ className }: { className?: string }) {
  const contact = useSiteContactLink();
  return (
    <nav
      aria-label="Informação legal"
      className={cn("flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground", className)}
    >
      {REQUIRED_SITE_LEGAL_LINKS.map((l) => (
        <Link key={l.href} to={l.href} className="underline-offset-4 hover:underline">
          {l.label}
        </Link>
      ))}
      {contact ? (
        <a href={contact.href} className="underline-offset-4 hover:underline">
          {contact.label}
        </a>
      ) : null}
    </nav>
  );
}
