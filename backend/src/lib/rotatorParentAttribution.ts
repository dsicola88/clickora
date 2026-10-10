import { isUnreplacedAdMacro } from "./adUrlMacros";

/**
 * Liga cliques de lander (CTA /track/r/) ao hop do rotador A/B.
 * O rotador grava clickora_click_id na URL da lander; a lander reenvia como parent_click_id.
 */

/** Identificadores que a API de conversões do Google / Bing / Meta / TikTok exige no clique da venda. */
export const AD_CLICK_QUERY_KEYS = ["gclid", "gbraid", "wbraid", "msclkid", "fbclid", "ttclid"] as const;

export type AdClickQueryKey = (typeof AD_CLICK_QUERY_KEYS)[number];
export type RotatorParentMeta = {
  parent_rotator_click_id: string;
  rotator_id: string;
  rotator_arm_id: string | null;
};

export function rotatorMetaFromParentClick(args: {
  parentId: string;
  parentUserId: string;
  ownerUserId: string;
  parentMetadata: unknown;
}): RotatorParentMeta | null {
  if (args.parentUserId !== args.ownerUserId) return null;
  if (!args.parentMetadata || typeof args.parentMetadata !== "object" || Array.isArray(args.parentMetadata)) {
    return null;
  }
  const m = args.parentMetadata as Record<string, unknown>;
  const rotatorId = typeof m.rotator_id === "string" ? m.rotator_id.trim() : "";
  if (!rotatorId) return null;
  const arm =
    typeof m.rotator_arm_id === "string" && m.rotator_arm_id.trim()
      ? m.rotator_arm_id.trim()
      : null;
  return {
    parent_rotator_click_id: args.parentId,
    rotator_id: rotatorId,
    rotator_arm_id: arm,
  };
}

function usableAdValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || isUnreplacedAdMacro(trimmed)) return null;
  return trimmed;
}

/** IDs de anúncio gravados no clique do rotador. */
export function adClickIdsFromMetadata(metadata: unknown): Partial<Record<AdClickQueryKey, string>> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const source = metadata as Record<string, unknown>;
  const out: Partial<Record<AdClickQueryKey, string>> = {};
  for (const key of AD_CLICK_QUERY_KEYS) {
    const value = usableAdValue(source[key]);
    if (value) out[key] = value;
  }
  return out;
}

/** Preenche só os IDs que o clique da presell não trouxe. */
export function fillMissingAdClickIds<T extends Partial<Record<AdClickQueryKey, string | undefined>>>(
  current: T,
  parentMetadata: unknown,
): T & Partial<Record<AdClickQueryKey, string | undefined>> {
  const parent = adClickIdsFromMetadata(parentMetadata);
  const next: T & Partial<Record<AdClickQueryKey, string | undefined>> = { ...current };
  for (const key of AD_CLICK_QUERY_KEYS) {
    if (!usableAdValue(next[key]) && parent[key]) next[key] = parent[key];
  }
  return next;
}

/** Acrescenta ao URL da lander os parâmetros do anúncio que ainda não estão lá. */
export function forwardAdQueryToUrl(
  rawUrl: string,
  params: Record<string, string | undefined | null>,
): string {
  try {
    const url = new URL(rawUrl);
    for (const [key, value] of Object.entries(params)) {
      const usable = usableAdValue(value);
      if (!usable || url.searchParams.has(key)) continue;
      url.searchParams.set(key, usable);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}
