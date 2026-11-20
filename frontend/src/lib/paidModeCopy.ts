/**
 * Frase canónica do modo Paid — uma verdade em wizard, shell, CM e estúdio.
 * Autopilot = aplica já · Copilot dono = aplica já · resto = Fila.
 */

export function paidModeCanonicalLine(paidMode: string | null | undefined): string {
  if (paidMode === "autopilot") {
    return "Autopilot: aplica já na Google quando os guardrails passam.";
  }
  return "Copilot: o dono aplica já (criar e estúdio, se guardrails OK); a equipa confirma em Aprovações.";
}

export function paidModeShortChip(paidMode: string | null | undefined): string {
  return paidMode === "autopilot" ? "Autopilot" : "Copilot";
}
