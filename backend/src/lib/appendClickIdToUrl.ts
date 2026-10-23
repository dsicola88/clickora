import { canonicalPlatformId } from "./affiliatePlatforms/parseAffiliatePostback";
import {
  outboundClickKeys,
  platformIdFromOfferHost,
  UNKNOWN_OUTBOUND_KEYS,
} from "./affiliatePlatforms/outboundClickParams";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Chaves onde lixo não-UUID (path id MaxWeb, campanha) pode ser substituído.
 * Digistore `cid`: nunca substituir se já existir (outro tracker / token proprietário)
 * — o UUID da dclickora vai em `sid1`.
 */
const REPLACEABLE_NON_UUID_KEYS = new Set([
  "subid",
  "subid1",
  "subid2",
  "sub3",
  "sid1",
  "src",
  "sck",
  "tid",
]);

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
 * Escreve se vazio; nunca substitui um UUID (outro tracker).
 * Substitui lixo não-UUID nas chaves de tracking conhecidas (exceto Digistore cid).
 */
function shouldWriteNetworkParam(key: string, existing: string | null): boolean {
  if (existing == null || existing.trim() === "") return true;
  if (UUID_RE.test(existing.trim())) return false;
  return REPLACEABLE_NON_UUID_KEYS.has(key);
}

/**
 * Acrescenta o UUID do clique ao URL da oferta.
 * Escreve sempre `clickora_click_id` e o(s) parâmetro(s) da rede.
 * Não substitui um UUID que a oferta já traz.
 */
export function appendClickIdToAffiliateUrl(destUrl: string, clickId: string, platform?: string | null): string {
  const platformId = platformFromUrl(destUrl, platform);
  const keys = outboundClickKeys(platformId);
  const networkKeys = keys.length > 0 ? keys : [...UNKNOWN_OUTBOUND_KEYS];
  try {
    const u = new URL(destUrl);
    u.searchParams.set("clickora_click_id", clickId);
    for (const key of networkKeys) {
      if (shouldWriteNetworkParam(key, u.searchParams.get(key))) {
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
      if (shouldWriteNetworkParam(key, existing)) {
        parts.push(`${key}=${encodeURIComponent(clickId)}`);
      }
    }
    return `${destUrl}${sep}${parts.join("&")}`;
  }
}
