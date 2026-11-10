import { useQuery } from "@tanstack/react-query";
import { brandingService } from "@/services/brandingService";
import { EMPTY_SUPPORT_CONTACTS, type PublicSupportContacts } from "@/lib/siteLegal";

/** Mesma chave que o Admin (favicon + contactos). */
export const PUBLIC_SUPPORT_CONTACTS_KEY = ["public-branding"] as const;

/** Contactos oficiais da instalação (superadmin). Sem valores inventados. */
export function usePublicSupportContacts() {
  return useQuery({
    queryKey: PUBLIC_SUPPORT_CONTACTS_KEY,
    queryFn: async (): Promise<PublicSupportContacts> => {
      const meta = await brandingService.getPublicMeta();
      return {
        support_email: meta.support_email,
        support_phone: meta.support_phone,
        support_phone_display: meta.support_phone_display,
        support_whatsapp_url: meta.support_whatsapp_url,
        configured: meta.configured,
        updated_at: meta.updated_at ?? null,
      };
    },
    staleTime: 60_000,
    placeholderData: EMPTY_SUPPORT_CONTACTS,
  });
}
