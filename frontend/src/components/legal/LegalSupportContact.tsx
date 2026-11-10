import type { ReactNode } from "react";
import { usePublicSupportContacts } from "@/hooks/usePublicSupportContacts";
import { supportMailto, supportTel } from "@/lib/siteLegal";

/** Linha de contacto para páginas legais — só mostra o que o superadmin configurou. */
export function LegalSupportContact() {
  const { data, isLoading } = usePublicSupportContacts();
  const email = data?.support_email;
  const phone = data?.support_phone;
  const phoneDisplay = data?.support_phone_display || phone;
  const mailto = supportMailto(email);
  const tel = supportTel(phone);
  const wa = data?.support_whatsapp_url;

  if (isLoading && !email && !phone) {
    return <span className="text-muted-foreground">A carregar contactos…</span>;
  }

  if (!email && !phone) {
    return (
      <span className="text-muted-foreground">
        Contactos ainda não publicados. O superadmin configura-os em Admin → Marca.
      </span>
    );
  }

  const parts: ReactNode[] = [];
  if (email && mailto) {
    parts.push(
      <a key="email" href={mailto} className="text-primary underline underline-offset-2">
        {email}
      </a>,
    );
  }
  if (phone && phoneDisplay) {
    parts.push(
      tel ? (
        <a key="phone" href={tel} className="text-primary underline underline-offset-2">
          {phoneDisplay}
        </a>
      ) : (
        <span key="phone">{phoneDisplay}</span>
      ),
    );
  }
  if (wa) {
    parts.push(
      <a
        key="wa"
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2"
      >
        WhatsApp
      </a>,
    );
  }

  return (
    <>
      {parts.map((node, i) => (
        <span key={i}>
          {i > 0 ? " · " : null}
          {node}
        </span>
      ))}
    </>
  );
}
