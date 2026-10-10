import { canonicalPlatformId } from "./affiliatePlatforms/parseAffiliatePostback";
import { outboundClickKeys, platformIdFromOfferHost } from "./affiliatePlatforms/outboundClickParams";

function platformFromUrl(destUrl: string, platform?: string | null): string | null {
  const named = canonicalPlatformId(platform);
  if (named) return named;
  try {
    return platformIdFromOfferHost(new URL(destUrl).hostname);
  } catch {
    const m = destUrl.match(/^https?:\/\/([^/?#]+)/i);
    return m ? platformIdFromOfferHost(m[1]) : null;
  }
}

/**
 * Acrescenta o UUID do clique ao URL da oferta.
 * Escreve sempre `clickora_click_id` e só os parâmetros da rede reconhecida
 * (host ou `platform`). Não substitui um parâmetro que a oferta já traz.
 */
export function appendClickIdToAffiliateUrl(destUrl: string, clickId: string, platform?: string | null): string {
  const platformId = platformFromUrl(destUrl, platform);
  try {
    const u = new URL(destUrl);
    u.searchParams.set("clickora_click_id", clickId);
    for (const key of outboundClickKeys(platformId)) {
      if (!u.searchParams.has(key)) u.searchParams.set(key, clickId);
    }
    return u.toString();
  } catch {
    const sep = destUrl.includes("?") ? "&" : "?";
    const parts = [`clickora_click_id=${encodeURIComponent(clickId)}`];
    for (const key of outboundClickKeys(platformId)) {
      const re = new RegExp(`(?:^|[?&])${key}=`, "i");
      if (!re.test(destUrl)) parts.push(`${key}=${encodeURIComponent(clickId)}`);
    }
    return `${destUrl}${sep}${parts.join("&")}`;
  }
}
