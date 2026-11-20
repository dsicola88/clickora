/**
 * Quando um change request do estúdio Google deve aplicar já na rede.
 * Autopilot: sempre. Copilot: só se o pedido for do dono do projecto (self-service).
 */
export function shouldApplyStudioChangeImmediately(opts: {
  paidMode: string;
  projectOwnerId: string;
  requestedById: string;
}): boolean {
  if (opts.paidMode === "autopilot") return true;
  return opts.projectOwnerId === opts.requestedById;
}
