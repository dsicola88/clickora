/**
 * Contactos públicos da instalação (SiteBranding) — fonte única para API pública e admin.
 */

export type SiteSupportContacts = {
  support_email: string | null;
  support_phone: string | null;
  support_phone_display: string | null;
  support_whatsapp_url: string | null;
  configured: boolean;
  updated_at: string | null;
};

export function normalizeSupportEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || v.length > 255) {
    throw new Error("Email de suporte inválido.");
  }
  return v;
}

/** Aceita +244… ou dígitos; devolve E.164 com +. */
export function normalizeSupportPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    throw new Error("Telefone inválido. Use o formato internacional (ex.: +244926510294).");
  }
  return `+${digits}`;
}

export function formatSupportPhoneDisplay(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const d = e164.replace(/\D/g, "");
  if (d.startsWith("244") && d.length >= 12) {
    return `+244 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9, 12)}`;
  }
  return e164.startsWith("+") ? e164 : `+${d}`;
}

export function supportWhatsappUrl(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const d = e164.replace(/\D/g, "");
  if (!d) return null;
  return `https://wa.me/${d}`;
}

export function mapSiteSupportContacts(row: {
  supportEmail?: string | null;
  supportPhone?: string | null;
  updatedAt?: Date | null;
} | null): SiteSupportContacts {
  const email = row?.supportEmail?.trim() || null;
  const phone = row?.supportPhone?.trim() || null;
  return {
    support_email: email,
    support_phone: phone,
    support_phone_display: formatSupportPhoneDisplay(phone),
    support_whatsapp_url: supportWhatsappUrl(phone),
    configured: Boolean(email || phone),
    updated_at: row?.updatedAt ? row.updatedAt.toISOString() : null,
  };
}
