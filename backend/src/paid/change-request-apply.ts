/**
 * Aplica o pedido remoto (APIs) quando o estado passa a `applied`.
 * Payloads mínimos esperados por `type` (Json no pedido):
 * - `update_budget` (Google): { campaign_id, daily_budget_micros }
 * - `add_keywords` (Google): { ad_group_id, keywords: [{ text, match_type: exact|phrase|broad }] }
 * - `publish_rsa` (Google): { paid_ads_rsa_id }
 * - `pause_entity` (Google): { entity: campaign|ad_group|keyword|rsa, id: uuid local }
 * - `meta_update_budget` (Meta): { meta_adset_id, daily_budget_cents }
 * - `meta_publish_creative` (Meta): { creative_id }
 * - `meta_pause_entity` (Meta): { level: campaign|adset|ad, id: uuid local }
 * - `tiktok_update_budget` (TikTok): { level: campaign|adgroup, campaign_id, daily_budget_micros }
 * - `tiktok_pause_entity` (TikTok): { level: campaign|adgroup, campaign_id }
 */
import type { PaidAdsChangeRequestType as ChangeRequestType } from "@prisma/client";

import {
  applyGoogleAddKeywords,
  applyGooglePauseEntity,
  applyGooglePublishRsa,
  applyGoogleUpdateBudget,
} from "./google-ads.mutations";
import { publishGoogleSearchCampaignFromLocal as publishGoogleCampaign } from "./google-ads.publish";
import { publishMetaCreateCampaignFromLocal } from "./meta-ads.publish";
import {
  applyMetaAdsetDailyBudget,
  applyMetaPauseEntity,
  applyMetaPublishCreative,
} from "./meta-ads.mutations";
import { publishTikTokCreateCampaignFromLocal } from "./tiktok-ads.publish";
import { applyTiktokPauseEntity, applyTiktokUpdateBudget } from "./tiktok-ads.mutations";

export type ApplyCrResult = { ok: true } | { ok: false; error: string };

function getStr(p: Record<string, unknown>, k: string): string | undefined {
  const v = p[k];
  return typeof v === "string" ? v : undefined;
}

function getNum(p: Record<string, unknown>, k: string): number | undefined {
  const v = p[k];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return undefined;
}

export async function applyChangeRequestRemote(
  projectId: string,
  type: ChangeRequestType,
  payload: unknown,
): Promise<ApplyCrResult> {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;

  try {
    switch (type) {
      case "create_campaign": {
        const id = getStr(p, "campaign_id");
        if (!id) return { ok: false, error: "Payload: campaign_id em falta." };
        return await publishGoogleCampaign(projectId, id);
      }
      case "update_budget": {
        const id = getStr(p, "campaign_id");
        const m = getNum(p, "daily_budget_micros");
        if (!id || m == null) {
          return { ok: false, error: "Payload: campaign_id e daily_budget_micros." };
        }
        return await applyGoogleUpdateBudget(projectId, {
          campaign_id: id,
          daily_budget_micros: m,
        });
      }
      case "add_keywords": {
        const ag = getStr(p, "ad_group_id");
        const kws = p.keywords;
        if (!ag || !Array.isArray(kws) || kws.length === 0) {
          return { ok: false, error: "Payload: ad_group_id e keywords[]." };
        }
        const keywords = kws.map((k) => {
          const o = k as Record<string, unknown>;
          return {
            text: String(o.text ?? ""),
            match_type: o.match_type as "exact" | "phrase" | "broad",
          };
        });
        return await applyGoogleAddKeywords(projectId, { ad_group_id: ag, keywords });
      }
      case "publish_rsa": {
        const id = getStr(p, "paid_ads_rsa_id");
        if (!id) return { ok: false, error: "Payload: paid_ads_rsa_id." };
        return await applyGooglePublishRsa(projectId, { paid_ads_rsa_id: id });
      }
      case "pause_entity": {
        const entity = p.entity;
        const id = getStr(p, "id");
        if (
          entity !== "campaign" &&
          entity !== "ad_group" &&
          entity !== "keyword" &&
          entity !== "rsa"
        ) {
          return { ok: false, error: "Payload: entity (campaign|ad_group|keyword|rsa) e id." };
        }
        if (!id) return { ok: false, error: "Payload: id em falta." };
        return await applyGooglePauseEntity(projectId, { entity, id });
      }
      case "meta_create_campaign": {
        const id = getStr(p, "campaign_id");
        if (!id) return { ok: false, error: "Payload: campaign_id em falta." };
        return await publishMetaCreateCampaignFromLocal(projectId, id, p);
      }
      case "meta_update_budget": {
        const id = getStr(p, "meta_adset_id");
        const c = getNum(p, "daily_budget_cents");
        if (!id || c == null) {
          return { ok: false, error: "Payload: meta_adset_id, daily_budget_cents." };
        }
        return await applyMetaAdsetDailyBudget(projectId, {
          meta_adset_id: id,
          daily_budget_cents: c,
        });
      }
      case "meta_publish_creative": {
        const id = getStr(p, "creative_id");
        if (!id) return { ok: false, error: "Payload: creative_id." };
        return await applyMetaPublishCreative(projectId, { creative_id: id });
      }
      case "meta_pause_entity": {
        const level = p.level;
        const id = getStr(p, "id");
        if (level !== "campaign" && level !== "adset" && level !== "ad") {
          return { ok: false, error: "Payload: level (campaign|adset|ad) e id." };
        }
        if (!id) return { ok: false, error: "Payload: id em falta." };
        return await applyMetaPauseEntity(projectId, { level, id });
      }
      case "tiktok_create_campaign": {
        const id = getStr(p, "campaign_id");
        if (!id) return { ok: false, error: "Payload: campaign_id em falta." };
        return await publishTikTokCreateCampaignFromLocal(projectId, id);
      }
      case "tiktok_update_budget": {
        const level = p.level;
        const cid = getStr(p, "campaign_id");
        const m = getNum(p, "daily_budget_micros");
        if ((level !== "campaign" && level !== "adgroup") || !cid || m == null) {
          return {
            ok: false,
            error: "Payload: level (campaign|adgroup), campaign_id, daily_budget_micros.",
          };
        }
        return await applyTiktokUpdateBudget(projectId, {
          level: level as "campaign" | "adgroup",
          campaign_id: cid,
          daily_budget_micros: m,
        });
      }
      case "tiktok_pause_entity": {
        const level = p.level;
        const cid = getStr(p, "campaign_id");
        if ((level !== "campaign" && level !== "adgroup") || !cid) {
          return { ok: false, error: "Payload: level (campaign|adgroup) e campaign_id." };
        }
        return await applyTiktokPauseEntity(projectId, {
          level: level as "campaign" | "adgroup",
          campaign_id: cid,
        });
      }
      default:
        return { ok: false, error: `Tipo de pedido desconhecido: ${String(type)}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro na aplicação remota." };
  }
}
