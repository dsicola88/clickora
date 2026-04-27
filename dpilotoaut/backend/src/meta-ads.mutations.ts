/**
 * Mutações Meta (orçamento ad set, publicar criativo, pausar) via Graph.
 */
import type { ChangeRequestType, EntityStatus } from "@prisma/client";

import { prisma } from "./prisma";

const GRAPH = "https://graph.facebook.com/v21.0";

export type CrResult = { ok: true } | { ok: false; error: string };

function normActId(adAccountId: string): string {
  return `act_${adAccountId.replace(/^act_/, "")}`;
}

function graphNodePost(
  objectId: string,
  accessToken: string,
  body: Record<string, string | number>,
): Promise<void> {
  const u = new URL(`${GRAPH}/${objectId.replace(/\D/g, "")}`);
  u.searchParams.set("access_token", accessToken);
  return fetch(u.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(
      Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)])) as Record<
        string,
        string
      >,
    ),
  }).then(async (res) => {
    const j = (await res.json()) as {
      success?: boolean;
      error?: { message?: string; error_user_msg?: string };
    };
    if (!res.ok || j.error) {
      throw new Error(
        j.error?.error_user_msg ?? j.error?.message ?? `Graph ${objectId} (${res.status})`,
      );
    }
  });
}

async function getMetaToken(projectId: string): Promise<{ err: string } | { token: string }> {
  const conn = await prisma.metaConnection.findUnique({ where: { projectId } });
  if (!conn || conn.status !== "connected" || !conn.tokenRef || !conn.adAccountId) {
    return { err: "Ligue a conta Meta (OAuth) e o Ad Account." };
  }
  if (conn.tokenRef.startsWith("state:")) {
    return { err: "Sessão Meta inválida." };
  }
  return { token: conn.tokenRef };
}

export async function applyMetaAdsetDailyBudget(
  projectId: string,
  p: { meta_adset_id: string; daily_budget_cents: number },
): Promise<CrResult> {
  const t0 = await getMetaToken(projectId);
  if ("err" in t0) return { ok: false, error: t0.err };
  const ag = await prisma.metaAdset.findFirst({
    where: { id: p.meta_adset_id, campaign: { projectId, platform: "meta_ads" } },
  });
  if (!ag?.externalId) {
    return { ok: false, error: "Conjunto sem ID Meta; publique a campanha antes." };
  }
  const cents = Math.max(100, Math.round(p.daily_budget_cents));
  try {
    await graphNodePost(ag.externalId, t0.token, { daily_budget: cents });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Meta update ad set" };
  }
  await prisma.metaAdset.update({
    where: { id: ag.id },
    data: { dailyBudgetCents: BigInt(cents) },
  });
  return { ok: true };
}

export async function applyMetaPauseEntity(
  projectId: string,
  p: { level: "campaign" | "adset" | "ad"; id: string },
): Promise<CrResult> {
  const t0 = await getMetaToken(projectId);
  if ("err" in t0) return { ok: false, error: t0.err };

  let ext: string | null = null;
  if (p.level === "campaign") {
    const c = await prisma.paidCampaign.findFirst({
      where: { id: p.id, projectId, platform: "meta_ads" },
    });
    if (!c) return { ok: false, error: "Campanha Meta não encontrada." };
    ext = c.externalCampaignId ?? null;
    if (ext) {
      try {
        await graphNodePost(ext, t0.token, { status: "PAUSED" });
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Pausar campanha" };
      }
      await prisma.paidCampaign.update({ where: { id: c.id }, data: { status: "paused" } });
    }
  } else if (p.level === "adset") {
    const a = await prisma.metaAdset.findFirst({
      where: { id: p.id, campaign: { projectId, platform: "meta_ads" } },
    });
    if (!a) return { ok: false, error: "Ad set não encontrado." };
    ext = a.externalId ?? null;
    if (ext) {
      try {
        await graphNodePost(ext, t0.token, { status: "PAUSED" });
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Pausar ad set" };
      }
      await prisma.metaAdset.update({ where: { id: a.id }, data: { status: "paused" } });
    }
  } else {
    const ad = await prisma.metaAd.findFirst({
      where: { id: p.id, adset: { campaign: { projectId, platform: "meta_ads" } } },
    });
    if (!ad) return { ok: false, error: "Anúncio Meta não encontrado." };
    ext = ad.externalAdId ?? null;
    if (ext) {
      try {
        await graphNodePost(ext, t0.token, { status: "PAUSED" });
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Pausar anúncio" };
      }
      await prisma.metaAd.update({ where: { id: ad.id }, data: { status: "paused" } });
    }
  }
  if (!ext) return { ok: false, error: "Entidade sem ID remoto no Meta." };
  return { ok: true };
}

/** Se o criativo ainda não tiver anúncio no Meta, cria (requer Página; mesmas regras que create). */
export async function applyMetaPublishCreative(
  projectId: string,
  p: { creative_id: string },
): Promise<CrResult> {
  const pageId = process.env.META_PROMOTED_PAGE_ID?.trim() || process.env.META_PAGE_ID?.trim();
  if (!pageId) {
    return {
      ok: false,
      error: "Defina META_PROMOTED_PAGE_ID para publicar criativos com ligação.",
    };
  }
  const t0 = await getMetaToken(projectId);
  if ("err" in t0) return { ok: false, error: t0.err };

  const cr = await prisma.metaCreative.findFirst({
    where: { id: p.creative_id, adset: { campaign: { projectId, platform: "meta_ads" } } },
    include: { adset: { include: { campaign: true, metaAds: true } } },
  });
  if (!cr) return { ok: false, error: "Criativo não encontrado." };
  if (cr.externalId && cr.adset.metaAds.some((a) => a.creativeId === cr.id && a.externalAdId)) {
    return { ok: true };
  }
  if (!cr.adset.externalId) {
    return { ok: false, error: "Ad set ainda sem ID Meta; publique a campanha antes." };
  }
  const conn = await prisma.metaConnection.findFirst({ where: { projectId } });
  if (!conn?.adAccountId) return { ok: false, error: "Ad Account em falta." };
  const act = normActId(conn.adAccountId);
  const actPath = `${act}/`;

  const CTA: Record<string, string> = {
    learn_more: "LEARN_MORE",
    shop_now: "SHOP_NOW",
    sign_up: "SIGN_UP",
    contact_us: "CONTACT_US",
    book_now: "BOOK_NOW",
    download: "DOWNLOAD",
    get_quote: "GET_QUOTE",
    subscribe: "SUBSCRIBE",
  };
  const cta = CTA[cr.cta] ?? "LEARN_MORE";
  const story = JSON.stringify({
    page_id: pageId,
    link_data: {
      message: (cr.primaryText ?? "").slice(0, 2000),
      name: (cr.headline ?? "").slice(0, 255),
      description: (cr.description ?? "")?.slice(0, 200) ?? "",
      link: cr.destinationUrl,
      call_to_action: { type: cta },
    },
  });

  const u = (path: string, body: Record<string, string>) => {
    const url = new URL(`${GRAPH}/${path.replace(/^\//, "")}`);
    url.searchParams.set("access_token", t0.token);
    return fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    }).then((r) => r.json() as Promise<{ id?: string; error?: { message?: string } }>);
  };

  let creativeId = cr.externalId;
  if (!creativeId) {
    const cRes = await u(`${actPath}adcreatives`, {
      name: `Cr — ${(cr.headline ?? "").slice(0, 60)}`.slice(0, 256),
      object_story_spec: story,
    });
    if (cRes.error) return { ok: false, error: cRes.error.message ?? "adcreatives" };
    if (!cRes.id) return { ok: false, error: "Graph sem id de criativo." };
    creativeId = cRes.id;
    await prisma.metaCreative.update({
      where: { id: cr.id },
      data: { externalId: creativeId, status: "live" as EntityStatus },
    });
  }
  const localAd = cr.adset.metaAds.find((a) => a.creativeId === cr.id);
  if (localAd && !localAd.externalAdId) {
    const aRes = await u(`${actPath}ads`, {
      name: (localAd.name ?? "Anúncio").slice(0, 256),
      adset_id: cr.adset.externalId,
      status: "ACTIVE",
      creative: JSON.stringify({ creative_id: creativeId }),
    });
    if (aRes.error) return { ok: false, error: aRes.error.message ?? "ads" };
    if (aRes.id) {
      await prisma.metaAd.update({
        where: { id: localAd.id },
        data: { externalAdId: aRes.id, status: "live" as EntityStatus },
      });
    }
  }
  return { ok: true };
}

export function isMetaMutationType(
  t: ChangeRequestType,
): t is "meta_update_budget" | "meta_publish_creative" | "meta_pause_entity" {
  return t === "meta_update_budget" || t === "meta_publish_creative" || t === "meta_pause_entity";
}
