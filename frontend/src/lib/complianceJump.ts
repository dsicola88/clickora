import type { MessageKey } from "@/i18n";

export type ComplianceJump = {
  anchorId: string;
  labelKey: MessageKey;
  enableFooter?: boolean;
};

/**
 * Mapeia texto de regra/suggestion → âncora no painel de compliance.
 * Campos de identidade primeiro; destino só com sinais explícitos (não “https” solto).
 */
export function resolveComplianceJump(input: string): ComplianceJump | null {
  const s = input.toLowerCase();

  if (/privacy|privacidad|cookie|política de priv|politica de priv/.test(s)) {
    return {
      anchorId: "compliance-privacy",
      labelKey: "pages.presells.compliance.jumpToPrivacy",
      enableFooter: true,
    };
  }
  if (/email|contact|contacto|contato/.test(s)) {
    return {
      anchorId: "compliance-email",
      labelKey: "pages.presells.compliance.jumpToContact",
      enableFooter: true,
    };
  }
  if (/business|identity|identidade|identidad|empresa|operator|responsável|responsable/.test(s)) {
    return {
      anchorId: "compliance-business",
      labelKey: "pages.presells.compliance.jumpToIdentity",
      enableFooter: true,
    };
  }
  if (/disclosure|afiliad|affiliate|divulga/.test(s)) {
    return {
      anchorId: "compliance-affiliate",
      labelKey: "pages.presells.compliance.jumpToDisclosure",
      enableFooter: true,
    };
  }
  if (/^dt-|dt-\d|\bdt-\b|destination|hoplink|open.?redirect|domínio|dominio|\bdomain\b|ssrf/.test(s)) {
    return {
      anchorId: "compliance-destination",
      labelKey: "pages.presells.compliance.jumpToDestination",
    };
  }
  return null;
}

/** Scroll/focus com retry — inputs de identidade só existem após ligar o footer. */
export function focusComplianceAnchor(anchorId: string, attempts = 16): void {
  const tryFocus = (left: number) => {
    const el = document.getElementById(anchorId);
    if (!el) {
      if (left <= 0) return;
      window.setTimeout(() => tryFocus(left - 1), 50);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      window.setTimeout(() => el.focus(), 120);
    }
  };
  tryFocus(attempts);
}
