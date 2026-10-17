import type { User } from "@prisma/client";
import { normalizePresellGenerationNiche } from "./presellGenerationNiche";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type OperatorIdentityInput = {
  fullName?: string | null;
  email?: string | null;
  saleNotifyEmail?: string | null;
};

export function resolveOperatorContactEmail(user: OperatorIdentityInput): string {
  const sale = asString(user.saleNotifyEmail);
  if (sale && EMAIL_RE.test(sale)) return sale;
  const email = asString(user.email);
  if (email && EMAIL_RE.test(email)) return email;
  return "";
}

export function resolveOperatorDisplayName(user: OperatorIdentityInput): string {
  return asString(user.fullName) || asString(user.email).split("@")[0] || "";
}

/**
 * Garante nome + e-mail nas definições para passar CT-002 (white e black).
 * Não sobrescreve valores já preenchidos pelo utilizador.
 */
export function enrichPresellSettingsWithOperatorIdentity(args: {
  settings: Record<string, unknown>;
  content: Record<string, unknown>;
  user: OperatorIdentityInput;
}): { settings: Record<string, unknown>; changed: boolean } {
  const settings = { ...args.settings };
  let changed = false;

  const niche = normalizePresellGenerationNiche(
    args.content.generationNiche ?? args.content.generation_niche,
  );
  const productName = asString(
    args.content.productName ?? args.content.product_name ?? args.content.title,
  );
  const operatorName = resolveOperatorDisplayName(args.user);
  const operatorEmail = resolveOperatorContactEmail(args.user);

  const businessName = asString(settings.businessName);
  if (!businessName) {
    const next =
      niche === "white" && productName
        ? productName
        : operatorName || productName;
    if (next) {
      settings.businessName = next.slice(0, 200);
      changed = true;
    }
  }

  const contactEmail = asString(settings.contactEmail);
  if (!contactEmail && operatorEmail) {
    settings.contactEmail = operatorEmail.slice(0, 320);
    changed = true;
  }

  return { settings, changed };
}

export type UserIdentityRow = Pick<User, "fullName" | "email" | "saleNotifyEmail">;

export function contentRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function settingsRecord(value: unknown): Record<string, unknown> {
  return contentRecord(value);
}

export function enrichPresellPageRecords(args: {
  content: unknown;
  settings: unknown;
  user: OperatorIdentityInput;
}): {
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  changed: boolean;
} {
  const content = contentRecord(args.content);
  const { settings, changed } = enrichPresellSettingsWithOperatorIdentity({
    settings: settingsRecord(args.settings),
    content,
    user: args.user,
  });
  return { content, settings, changed };
}
