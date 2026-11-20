/**
 * Frase canónica do modo Paid — uma verdade em wizard, shell, CM e estúdio.
 * Textos via i18n (`pages.dpilot.google.cm.*`); Autopilot/Copilot = nomes de produto localizados.
 */
import type { MessageKey } from "@/i18n";

export function paidModeShortChipKey(paidMode: string | null | undefined): MessageKey {
  return paidMode === "autopilot"
    ? "pages.dpilot.google.cm.modeAutopilot"
    : "pages.dpilot.google.cm.modeCopilot";
}

export function paidModeCanonicalLineKey(paidMode: string | null | undefined): MessageKey {
  return paidMode === "autopilot"
    ? "pages.dpilot.google.cm.modeLineAutopilot"
    : "pages.dpilot.google.cm.modeLineCopilot";
}

export function paidModeCanonicalLine(
  paidMode: string | null | undefined,
  t: (key: MessageKey) => string,
): string {
  return t(paidModeCanonicalLineKey(paidMode));
}

export function paidModeShortChip(
  paidMode: string | null | undefined,
  t: (key: MessageKey) => string,
): string {
  return t(paidModeShortChipKey(paidMode));
}
