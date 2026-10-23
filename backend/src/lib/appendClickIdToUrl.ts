import { canonicalPlatformId } from "./affiliatePlatforms/parseAffiliatePostback";
import { outboundClickKeys, platformIdFromOfferHost } from "./affiliatePlatforms/outboundClickParams";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

/** MaxWeb/BuyGoods: sobrescrever lixo não-UUID (path id, vazio); nunca um UUID de outro tracker. */
function shouldWriteNetworkParam(
  platformId: string | null,
  key: string,
  existing: string | null,
): boolean {
  if (existing == null || existing.trim() === "") return true;
  if (UUID_RE.test(existing.trim())) return false;
  if (platformId === "maxweb" || platformId === "buygoods") {
    return key === "subid" || key === "subid2";
  }
  return false;
}

/**
 * Acrescenta o UUID do clique ao URL da oferta.
 * Escreve sempre `clickora_click_id` e o parâmetro da rede reconhecida.
 * Num domínio desconhecido escreve `subid`, que é o que a MaxWeb e a BuyGoods devolvem.
 * MaxWeb/BuyGoods: também `subid2` (eco {SUBID2}) — o lander MaxWeb troca `subid` pelo id do path.
 * Não substitui um UUID que a oferta já traz.
 */
export function appendClickIdToAffiliateUrl(destUrl: string, clickId: string, platform?: string | null): string {
  const platformId = platformFromUrl(destUrl, platform);
  const keys = outboundClickKeys(platformId);
  const networkKeys = keys.length > 0 ? keys : ["subid"];
  try {
    const u = new URL(destUrl);
    u.searchParams.set("clickora_click_id", clickId);
    for (const key of networkKeys) {
      if (shouldWriteNetworkParam(platformId, key, u.searchParams.get(key))) {
        u.searchParams.set(key, clickId);
      }
    }
    return u.toString();
  } catch {
    const sep = destUrl.includes("?") ? "&" : "?";
    const parts = [`clickora_click_id=${encodeURIComponent(clickId)}`];
    for (const key of networkKeys) {
      const re = new RegExp(`(?:^|[?&])${key}=([^&]*)`, "i");
      const m = re.exec(destUrl);
      const existing = m ? decodeURIComponent(m[1] || "") : null;
      if (shouldWriteNetworkParam(platformId, key, existing)) {
        parts.push(`${key}=${encodeURIComponent(clickId)}`);
      }
    }
    return `${destUrl}${sep}${parts.join("&")}`;
  }
}
