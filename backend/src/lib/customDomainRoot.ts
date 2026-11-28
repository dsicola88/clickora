/**
 * Raiz (`/`) dos domínios personalizados dos assinantes.
 *
 * Política (Google Ads / transparência):
 * - A raiz NUNCA escolhe sozinha uma presell («última editada») e nunca redireciona.
 * - Domínio novo → página neutra até o assinante escolher manualmente «Presell ao abrir».
 * - Com escolha explícita e válida, a presell é renderizada na própria `/` (HTTP 200, sem 301/302).
 *
 * Função pura (sem Prisma) para ser testável; o controller só carrega a linha da BD.
 */

export type RootDomain = {
  id: string;
  userId: string;
  isDefault: boolean;
  rootPresellId: string | null;
  purpose: string;
};

export type RootPage = {
  id: string;
  userId: string;
  customDomainId: string | null;
  status: string;
};

/**
 * A presell pertence a este domínio? Presells antigas sem domínio (`customDomainId = null`) contam
 * para o domínio padrão — o painel mostra o link público delas nesse domínio.
 */
export function presellBelongsToDomain(
  page: Pick<RootPage, "userId" | "customDomainId">,
  domain: Pick<RootDomain, "id" | "userId" | "isDefault">,
): boolean {
  if (page.userId !== domain.userId) return false;
  if (page.customDomainId === domain.id) return true;
  return page.customDomainId === null && domain.isDefault;
}

/**
 * Elegível para servir na raiz: do mesmo dono e publicada. A escolha explícita (`rootPresellId`) basta —
 * troca de domínio principal, failover e rollback mudam `customDomainId`, e a raiz que está como
 * Final URL no Ads tem de continuar a servir a mesma página.
 */
export function isEligibleRootPresell(page: RootPage, domain: RootDomain): boolean {
  return page.status === "published" && page.userId === domain.userId;
}

export type RootDecision<P extends RootPage> =
  | { kind: "tracking" }
  | { kind: "neutral"; reason: "not_selected" | "selection_unavailable" }
  | { kind: "page"; page: P };

export async function decideRootPresell<P extends RootPage>(
  domain: RootDomain,
  loadPage: (presellId: string) => Promise<P | null>,
): Promise<RootDecision<P>> {
  if (domain.purpose === "tracking") return { kind: "tracking" };
  if (!domain.rootPresellId) return { kind: "neutral", reason: "not_selected" };
  const page = await loadPage(domain.rootPresellId);
  if (!page || !isEligibleRootPresell(page, domain)) {
    return { kind: "neutral", reason: "selection_unavailable" };
  }
  return { kind: "page", page };
}
