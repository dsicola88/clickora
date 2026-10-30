import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma, { systemPrisma } from "../lib/prisma";
import { evaluateSubscriptionAccess } from "../lib/subscription";
import { createPostbackToken, verifyPostbackToken } from "../lib/postbackToken";
import { publicApiBaseFromRequest } from "../lib/publicApiBase";
import { appendClickIdToAffiliateUrl } from "../lib/appendClickIdToUrl";
import { canonicalPlatformId } from "../lib/affiliatePlatforms/parseAffiliatePostback";
import { syncDirectGclidConversionToGoogleAds } from "../modules/googleAds/googleAds.service";
import { notifyTelegramClick } from "../lib/telegramNotifications";
import {
  countrySourceMeta,
  isCdn77EdgeIp,
  lookupIpForTools,
  resolveVisitorCountryFromRequest,
} from "../lib/cdn77Visitor";
import { isFastlyEdgeIp } from "../lib/fastlyEdges";
import { assessClickQuality } from "../lib/detectBot";
import { enforceTrackingRules } from "../lib/trackGuard";
import { countryOnCloakDenyList, sendSafeVisitorPage } from "../lib/presellEnterpriseCloak";
import { datacenterClickMeta, datacenterClickPlace } from "../lib/ipNetworkClass";
import { reportCloudClickMeta } from "../lib/reportCloudIpRanges";
import { assertPresellAllowedOnRequestHost } from "../lib/presellHostAccess";
import { pickRotatorDestination } from "../lib/trafficRotator.service";
import { mergeSubIdsWithPath, parsePublicPathSubTail, pathSubForMetadata } from "../lib/pathSubIds";
import { billingUserId } from "../lib/requestContext";
import { countPlanClicksThisMonth } from "../lib/planClickQuota";
import {
  voluumStyleMetadata,
  voluumStyleMetadataFromExpressQuery,
  voluumStyleQuerySchema,
} from "../lib/voluumStyleTrackingParams";
import { normalizeUtmDimension, isUnreplacedAdMacro } from "../lib/adUrlMacros";
import { planAllowsAffiliateWebhook } from "../lib/planAffiliateWebhook";
import { recordTrackRedirectLatency } from "../lib/opsObservability";
import { extractClientIp } from "../lib/clientIp";
import { formatDeviceLabel, parseUserAgent } from "../lib/parseUserAgent";
import { isFunnelStep, recordAffiliateFunnelStep } from "../lib/funnelStepEvent";
import { fillMissingAdClickIds, forwardAdQueryToUrl, rotatorMetaFromParentClick } from "../lib/rotatorParentAttribution";
import {
  affiliateLinkFromPresellPage,
  isRedirectToAllowedOffer,
} from "../lib/trackOfferRedirectGuard";

const clickSchema = z.object({
  presell_id: z.string().min(1),
  source: z.string().optional(),
  medium: z.string().optional(),
  campaign: z.string().optional(),
  referrer: z.string().optional(),
  utm_source: z.string().optional(),
  gclid: z.string().optional(),
  gbraid: z.string().optional(),
  wbraid: z.string().optional(),
  fbclid: z.string().optional(),
  fbp: z.string().optional(),
  ttclid: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
  msclkid: z.string().optional(),
});

const impressionSchema = z.object({
  presell_id: z.string().min(1),
  referrer: z.string().optional(),
});

const eventSchema = z.object({
  presell_id: z.string().min(1),
  event_type: z.enum(["click", "impression", "conversion", "lead", "sale", "pageview"]),
  metadata: z.record(z.unknown()).optional(),
  value: z.number().nonnegative().optional(),
  currency: z.string().min(3).max(3).optional(),
  transaction_id: z.string().optional(),
  gclid: z.string().optional(),
  fbclid: z.string().optional(),
  ttclid: z.string().optional(),
  msclkid: z.string().optional(),
  source: z.string().optional(),
  medium: z.string().optional(),
  campaign: z.string().optional(),
  referrer: z.string().optional(),
});

const redirectSchema = z
  .object({
    /** Opcional: se ausente/vazio/#, usa o hoplink da presell (CTAs bake só com /track/r/:id). */
    to: z.preprocess(
      (v) => {
        if (v == null) return undefined;
        const s = String(v).trim();
        if (!s || s === "#") return undefined;
        return s;
      },
      z.string().url().optional(),
    ),
    source: z.string().optional(),
    medium: z.string().optional(),
    campaign: z.string().optional(),
    referrer: z.string().optional(),
    utm_source: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_campaign: z.string().optional(),
    gclid: z.string().optional(),
    gbraid: z.string().optional(),
    wbraid: z.string().optional(),
    fbclid: z.string().optional(),
    ttclid: z.string().optional(),
    utm_term: z.string().optional(),
    utm_content: z.string().optional(),
    msclkid: z.string().optional(),
    /** Cookie Meta _fbp (opcional) — pode vir em query se o lander o passar. */
    fbp: z.string().optional(),
    /** Sub-IDs (estilo ClickMagick) para segmentar fontes no relatório. */
    sub1: z.string().max(512).optional(),
    sub2: z.string().max(512).optional(),
    sub3: z.string().max(512).optional(),
    /**
     * Clique do rotador A/B (clickora_click_id na URL da lander).
     * Propaga rotator_id / rotator_arm_id para o clique da oferta.
     */
    parent_click_id: z.string().uuid().optional(),
    /** Rede de afiliados desta oferta. Isola os parâmetros de clique (cid, subid, src, tid). */
    network: z.string().max(64).optional(),
  })
  .merge(voluumStyleQuerySchema);

/** Query pública do rotador: mesma atribuição que o redirect, sem `to`; opcional `access_code`. */
const rotatorPublicQuerySchema = redirectSchema
  .omit({ to: true })
  .extend({ access_code: z.string().max(256).optional() })
  .passthrough();

function sendTrackingPixelGif(res: Response) {
  const pixelBase64 = "R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
  const buffer = Buffer.from(pixelBase64, "base64");
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  return res.status(200).send(buffer);
}

/**
 * Funnel Pixel / Event GET: img 1×1 autenticada por token de postback.
 * Grava lead com metadata.funnel_step (checkout|lander). Não é venda.
 */
async function recordFunnelStepFromPixel(req: Request, res: Response) {
  const stepRaw = (req.params.step || "").toLowerCase().replace(/\.gif$/i, "");
  if (!isFunnelStep(stepRaw)) {
    return sendTrackingPixelGif(res);
  }

  const token =
    firstQueryString(req.query, "token") ||
    req.headers["x-postback-token"]?.toString();
  const decoded = token ? verifyPostbackToken(token) : null;
  if (!decoded) {
    return sendTrackingPixelGif(res);
  }

  const subGate = await systemPrisma.subscription.findUnique({
    where: { userId: decoded.userId },
    include: { plan: true },
  });
  if (!planAllowsAffiliateWebhook(subGate?.plan)) {
    return sendTrackingPixelGif(res);
  }

  const subidCandidate =
    realClickIdQuery(req.query, "subid") ||
    realClickIdQuery(req.query, "SUBID") ||
    realClickIdQuery(req.query, "clickora_click_id") ||
    realClickIdQuery(req.query, "cid") ||
    realClickIdQuery(req.query, "subid1") ||
    realClickIdQuery(req.query, "sub3");

  const platform =
    firstQueryString(req.query, "platform") ||
    firstQueryString(req.query, "network") ||
    "affiliate";

  const ip = extractClientIp(req);
  const userAgent = req.headers["user-agent"] || "";
  const referrer = typeof req.headers.referer === "string" ? req.headers.referer : null;

  await recordAffiliateFunnelStep({
    userId: decoded.userId,
    step: stepRaw,
    platform,
    clickIdCandidate: subidCandidate,
    ip,
    userAgent,
    referrer,
    headers: req.headers as Record<string, string | string[] | undefined>,
  });

  return sendTrackingPixelGif(res);
}

function firstQueryString(q: Request["query"], key: string): string | undefined {
  const v = q[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
  return undefined;
}

/** Descarta macros não substituídas (`{gclid}`, `{{campaign.name}}`, …). */
function realClickIdQuery(q: Request["query"], key: string): string | undefined {
  const v = firstQueryString(q, key);
  if (!v || isUnreplacedAdMacro(v)) return undefined;
  return v;
}

/** utm_term / utm_content: ignora `{keyword}` literal (teste manual ou URL mal gerada). */
function realUtmDimensionQuery(q: Request["query"], key: string): string | undefined {
  return normalizeUtmDimension(firstQueryString(q, key)) ?? undefined;
}

function realUtmDimensionBody(raw: string | undefined | null): string | undefined {
  return normalizeUtmDimension(raw) ?? undefined;
}

function compactTrackingMeta(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && !v.trim()) continue;
    out[k] = v;
  }
  return out;
}

/** Query string do GET /track/pixel/… — mesma atribuição que o redirect de clique (UTMs + IDs de rede). */
function impressionAttributionFromPixelQuery(query: Request["query"]) {
  const referrer = firstQueryString(query, "referrer");
  const utm_source = firstQueryString(query, "utm_source");
  const utm_medium = firstQueryString(query, "utm_medium");
  const utm_campaign = firstQueryString(query, "utm_campaign");
  const utm_term = realUtmDimensionQuery(query, "utm_term");
  const utm_content = realUtmDimensionQuery(query, "utm_content");
  const gclid = realClickIdQuery(query, "gclid");
  const gbraid = realClickIdQuery(query, "gbraid");
  const wbraid = realClickIdQuery(query, "wbraid");
  const fbclid = realClickIdQuery(query, "fbclid");
  const ttclid = realClickIdQuery(query, "ttclid");
  const msclkid = realClickIdQuery(query, "msclkid");
  const sub1 = firstQueryString(query, "sub1");
  const sub2 = firstQueryString(query, "sub2");
  const sub3 = firstQueryString(query, "sub3");
  const source = utm_source || firstQueryString(query, "source");
  const medium = utm_medium || firstQueryString(query, "medium");
  const campaign = utm_campaign || firstQueryString(query, "campaign");
  const metadata = compactTrackingMeta({
    gclid,
    gbraid,
    wbraid,
    fbclid,
    ttclid,
    msclkid,
    utm_term,
    utm_content,
    utm_source: utm_source ?? source,
    source,
    medium,
    campaign,
    ...(sub1 ? { sub1 } : {}),
    ...(sub2 ? { sub2 } : {}),
    ...(sub3 ? { sub3 } : {}),
    ...voluumStyleMetadataFromExpressQuery(query),
  });
  return { referrer, source, medium, campaign, metadata };
}

async function affiliateNetworkForRedirect(args: {
  queryNetwork?: string;
  userId: string;
  presellId: string;
}): Promise<string | null> {
  const fromQuery = args.queryNetwork?.trim();
  if (fromQuery && canonicalPlatformId(fromQuery)) return fromQuery;
  const camp = await systemPrisma.affiliateCampaign.findFirst({
    where: { userId: args.userId, presellId: args.presellId, platform: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { platform: true },
  });
  return camp?.platform?.trim() || fromQuery || null;
}

/**
 * País gravado: o da CDN77, ou o do IP de quem clicou.
 * O nó não tem país. routeCountry é o mesmo valor, para cloak e rotador.
 */
function visitorClickPlace(req: Request, ip: string) {
  if (isFastlyEdgeIp(ip)) {
    return {
      visitor: { country: null, source: "none" as const },
      place: null,
      country: null as string | null,
      routeCountry: null as string | null,
      countryMeta: { ip_network: "Fastly" },
    };
  }
  const visitor = resolveVisitorCountryFromRequest(req, ip);
  // País CDN77 ≠ saltar cloud: o IP gravado é o visitante; AWS/GCP ainda vão para exclude_from_kpi.
  const place = isCdn77EdgeIp(ip) ? null : datacenterClickPlace(ip);
  const country = visitor.country;
  return {
    visitor,
    place,
    country,
    routeCountry: country,
    countryMeta: countrySourceMeta(visitor.source),
  };
}

function expressWildcardPathSuffix(req: Request): string | undefined {
  const p = req.params as Record<string, string | undefined>;
  const t = p["0"];
  return typeof t === "string" && t.length > 0 ? t : undefined;
}

/**
 * Pageview via POST /track/event.
 * - Funciona com `async` (não depende só de document.currentScript).
 * - presell: data-presell-id ou path /p/{uuid}.
 * - Copia gclid/UTMs da query + _fbp para metadata (Ads → atribuição).
 */
const CLICKORA_EMBED_JS = `(function(){function findSc(){var s=document.currentScript;if(s&&s.src)return s;var a=document.getElementsByTagName("script");for(var i=a.length-1;i>=0;i--){if(a[i].src&&/clickora\\.min\\.js/i.test(a[i].src))return a[i];}return null;}var sc=findSc();if(!sc||!sc.src)return;var u=new URL(sc.src);var apiBase=sc.getAttribute("data-api-base")||(u.origin+u.pathname.replace(/\\/track\\/v2\\/clickora\\.min\\.js$/i,""));var userId=sc.getAttribute("data-id")||"";var explicit=(sc.getAttribute("data-presell-id")||"").trim();var m=typeof location!=="undefined"?location.pathname.match(/\\/p\\/([a-f0-9-]{36})/i):null;var presellId=explicit||(m&&m[1])||"";if(!presellId)return;var ref=typeof document!=="undefined"&&document.referrer?document.referrer:void 0;var payload={presell_id:presellId,event_type:"pageview",referrer:ref};var md={};if(userId)md.clickora_user_id=userId;try{var q=new URLSearchParams(location.search||"");["gclid","gbraid","wbraid","fbclid","ttclid","msclkid","utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach(function(k){var v=q.get(k);if(v)md[k]=v;});}catch(e){}var cm=typeof document!=="undefined"&&document.cookie?document.cookie.match(/(?:^|;)\\s*_fbp=([^;]+)/):null;if(cm){var fb=decodeURIComponent(cm[1].trim());if(fb)md.fbp=fb;}if(Object.keys(md).length)payload.metadata=md;try{fetch(apiBase+"/track/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),credentials:"omit",keepalive:true,mode:"cors"});}catch(e){}})();`;

export const trackController = {
  async redirect(req: Request, res: Response) {
    const t0 = performance.now();
    const presellId = req.params.presellId;
    const parsed = redirectSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "Parâmetros inválidos", details: parsed.error.flatten() });
    const {
      to: toRaw,
      source,
      medium: mediumRaw,
      campaign: campaignRaw,
      referrer,
      gclid,
      gbraid,
      wbraid,
      fbclid,
      fbp,
      ttclid,
      utm_term: utmTermRaw,
      utm_content: utmContentRaw,
      msclkid,
      utm_source,
      utm_medium: utmMediumRaw,
      utm_campaign: utmCampaignRaw,
      sub1: qSub1,
      sub2: qSub2,
      sub3: qSub3,
      parent_click_id: parentClickIdRaw,
      network: queryNetwork,
    } = parsed.data;
    const utm_term = realUtmDimensionBody(utmTermRaw);
    const utm_content = realUtmDimensionBody(utmContentRaw);
    /** Preferir utm_* (URL Builder / ads) — igual ao pixel; descartar macros literais. */
    const medium =
      realUtmDimensionBody(utmMediumRaw) || realUtmDimensionBody(mediumRaw) || mediumRaw || undefined;
    const campaign =
      realUtmDimensionBody(utmCampaignRaw) || realUtmDimensionBody(campaignRaw) || campaignRaw || undefined;

    const pathTail = expressWildcardPathSuffix(req);
    if (pathTail != null && pathTail.trim() !== "" && !parsePublicPathSubTail(pathTail)) {
      return res.status(400).json({
        error:
          "Sufixo de caminho inválido. Use apenas letras, números, ponto, _ e hífen por segmento (até 10 níveis, ex.: /fb/campanha/anuncio).",
      });
    }
    const pathSub = parsePublicPathSubTail(pathTail);
    const { sub1, sub2, sub3, pathMeta } = mergeSubIdsWithPath(
      { sub1: qSub1, sub2: qSub2, sub3: qSub3 },
      pathSub,
    );
    const pathMetaJson = pathSubForMetadata(pathMeta) as Record<string, string | string[]>;
    const voluumMeta = voluumStyleMetadata(parsed.data);

    const page = await systemPrisma.presellPage.findUnique({ where: { id: presellId } });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });
    if (!(await assertPresellAllowedOnRequestHost(req, page.userId))) {
      return res.status(404).json({ error: "Página não encontrada" });
    }
    if (page.status !== "published") {
      console.warn("[track.redirect] presell não publicada → sem oferta", { presellId, status: page.status });
      return sendSafeVisitorPage(res, page.settings);
    }
    const configuredOffer = affiliateLinkFromPresellPage(page.content, page.tracking);
    const to = (toRaw && toRaw.trim()) || configuredOffer;
    if (!to || !/^https?:\/\//i.test(to)) {
      console.warn("[track.redirect] sem hoplink configurado", { presellId });
      return sendSafeVisitorPage(res, page.settings);
    }
    if (!isRedirectToAllowedOffer(to, configuredOffer)) {
      console.warn("[track.redirect] parâmetro to não autorizado", {
        presellId,
        host: (() => {
          try {
            return new URL(to).hostname;
          } catch {
            return "?";
          }
        })(),
      });
      return sendSafeVisitorPage(res, page.settings);
    }
    const accessCheck = await validateOwnerCanTrack(page.userId);
    if (!accessCheck.ok) {
      console.warn("[track.redirect] owner sem acesso → sem oferta", { presellId });
      return sendSafeVisitorPage(res, page.settings);
    }

    const ip = extractClientIp(req);
    const seen = visitorClickPlace(req, ip);
    const place = seen.place;
    const userAgent = req.headers["user-agent"] || "";
    const guard = await enforceTrackingRules({
      ownerUserId: page.userId,
      presellPageId: page.id,
      ip,
      userAgent,
      headers: req.headers as Record<string, string | string[] | undefined>,
      channel: "redirect",
      recordedEventType: "click",
    });
    if (!guard.ok) {
      console.warn("[track.redirect] bloqueado sem oferta", { presellId, reason: guard.reason, ip });
      return sendSafeVisitorPage(res, page.settings);
    }
    if (countryOnCloakDenyList(page.settings, seen.routeCountry)) {
      console.warn("[track.redirect] país sem oferta", { presellId, ip });
      return sendSafeVisitorPage(res, page.settings);
    }

    const { device, botMeta } = deviceAndBotMeta(userAgent, { headers: req.headers as Record<string, string | string[] | undefined>, ip });

    let rotatorParentMeta: Record<string, unknown> = {};
    let parentMetadata: unknown = null;
    if (parentClickIdRaw) {
      const parentEv = await systemPrisma.trackingEvent.findFirst({
        where: { id: parentClickIdRaw, eventType: "click" },
        select: { id: true, userId: true, metadata: true },
      });
      if (parentEv) {
        const linked = rotatorMetaFromParentClick({
          parentId: parentEv.id,
          parentUserId: parentEv.userId,
          ownerUserId: page.userId,
          parentMetadata: parentEv.metadata,
        });
        if (linked) {
          parentMetadata = parentEv.metadata;
          rotatorParentMeta = {
            parent_rotator_click_id: linked.parent_rotator_click_id,
            rotator_id: linked.rotator_id,
            ...(linked.rotator_arm_id ? { rotator_arm_id: linked.rotator_arm_id } : {}),
          };
        }
      }
    }
    const adIds = fillMissingAdClickIds(
      { gclid, gbraid, wbraid, msclkid, fbclid, ttclid },
      rotatorParentMeta.parent_rotator_click_id ? parentMetadata : null,
    );

    const click = await systemPrisma.$transaction(async (tx) => {
      const ev = await tx.trackingEvent.create({
        data: {
          userId: page.userId,
          presellPageId: page.id,
          eventType: "click",
          source,
          medium,
          campaign,
          referrer,
          country: seen.country ?? undefined,
          ipAddress: ip,
          userAgent,
          device,
          metadata: {
            gclid: adIds.gclid,
            gbraid: adIds.gbraid,
            wbraid: adIds.wbraid,
            fbclid: adIds.fbclid,
            fbp,
            ttclid: adIds.ttclid,
            msclkid: adIds.msclkid,
            utm_term,
            utm_content,
            utm_campaign: campaign || undefined,
            utm_source: utm_source ?? source,
            source,
            medium,
            campaign,
            redirect_to: to,
            // Cloud/datacenter → exclude_from_kpi (Situação Cloud alinhada ao KPI). Sem auto-blacklist.
            ...(place ? datacenterClickMeta(ip) : reportCloudClickMeta(ip)),
            ...seen.countryMeta,
            ...(sub1 ? { sub1 } : {}),
            ...(sub2 ? { sub2 } : {}),
            ...(sub3 ? { sub3 } : {}),
            ...pathMetaJson,
            ...voluumMeta,
            ...botMeta,
            ...rotatorParentMeta,
          } as Prisma.InputJsonValue,
        },
      });
      await tx.presellPage.update({
        where: { id: page.id },
        data: { clicks: { increment: 1 } },
      });
      return ev;
    });

    notifyTelegramClick(page.userId, {
      presellTitle: page.title,
      clickId: click.id,
      campaign,
    });

    const offerNetwork = await affiliateNetworkForRedirect({
      queryNetwork,
      userId: page.userId,
      presellId: page.id,
    });
    const redirectTo = appendClickIdToAffiliateUrl(to, click.id, offerNetwork);
    recordTrackRedirectLatency(performance.now() - t0);
    return res.redirect(302, redirectTo);
  },

  async rotatorRedirect(req: Request, res: Response) {
    const t0 = performance.now();
    const rotatorId = req.params.rotatorId;
    if (!z.string().uuid().safeParse(rotatorId).success) {
      return res.status(404).json({ error: "Rotador não encontrado" });
    }

    const parsed = rotatorPublicQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Parâmetros inválidos", details: parsed.error.flatten() });
    }
    const q = parsed.data;
    const {
      source,
      medium: mediumRaw,
      campaign: campaignRaw,
      referrer,
      gclid,
      gbraid,
      wbraid,
      fbclid,
      fbp,
      ttclid,
      utm_term: rotUtmTermRaw,
      utm_content: rotUtmContentRaw,
      msclkid,
      utm_source,
      utm_medium: utmMediumRaw,
      utm_campaign: utmCampaignRaw,
      sub1: rSub1,
      sub2: rSub2,
      sub3: rSub3,
      access_code,
      network: rotatorNetwork,
    } = q;
    const utm_term = realUtmDimensionBody(rotUtmTermRaw);
    const utm_content = realUtmDimensionBody(rotUtmContentRaw);
    const medium =
      realUtmDimensionBody(utmMediumRaw) || realUtmDimensionBody(mediumRaw) || mediumRaw || undefined;
    const campaign =
      realUtmDimensionBody(utmCampaignRaw) || realUtmDimensionBody(campaignRaw) || campaignRaw || undefined;

    const rPathTail = expressWildcardPathSuffix(req);
    if (rPathTail != null && rPathTail.trim() !== "" && !parsePublicPathSubTail(rPathTail)) {
      return res.status(400).json({
        error:
          "Sufixo de caminho inválido. Use apenas letras, números, ponto, _ e hífen por segmento (até 10 níveis, ex.: /fb/campanha/anuncio).",
      });
    }
    const rPathSub = parsePublicPathSubTail(rPathTail);
    const { sub1, sub2, sub3, pathMeta: rotPathMeta } = mergeSubIdsWithPath(
      { sub1: rSub1, sub2: rSub2, sub3: rSub3 },
      rPathSub,
    );
    const rotPathMetaJson = pathSubForMetadata(rotPathMeta) as Record<string, string | string[]>;
    const rotVoluumMeta = voluumStyleMetadata(q);

    const rot = await systemPrisma.trafficRotator.findFirst({
      where: { id: rotatorId, isActive: true },
      include: { contextPresell: { select: { id: true, userId: true, title: true, status: true, settings: true } } },
    });
    if (!rot || rot.contextPresell.status !== "published") {
      return res.status(404).json({ error: "Rotador não encontrado" });
    }

    if (rot.accessCode && rot.accessCode.length > 0) {
      const ok = (access_code || "").trim() === rot.accessCode.trim();
      if (!ok) {
        return res.status(403).json({ error: "Código de acesso inválido ou em falta (?access_code=)" });
      }
    }

    if (!(await assertPresellAllowedOnRequestHost(req, rot.userId))) {
      return res.status(404).json({ error: "Página não encontrada" });
    }

    const accessCheck = await validateOwnerCanTrack(rot.userId);
    if (!accessCheck.ok) {
      console.warn("[track.rotator] owner sem acesso → sem oferta", { rotatorId });
      return sendSafeVisitorPage(res, rot.contextPresell.settings);
    }

    const ip = extractClientIp(req);
    const seen = visitorClickPlace(req, ip);
    const place = seen.place;
    const country = seen.routeCountry;
    const userAgent = req.headers["user-agent"] || "";
    const guard = await enforceTrackingRules({
      ownerUserId: rot.userId,
      presellPageId: rot.contextPresellId,
      ip,
      userAgent,
      headers: req.headers as Record<string, string | string[] | undefined>,
      channel: "rotator_redirect",
      recordedEventType: "click",
    });
    if (!guard.ok) {
      console.warn("[track.rotator] bloqueado sem oferta", { rotatorId, reason: guard.reason });
      return sendSafeVisitorPage(res, rot.contextPresell.settings);
    }
    if (countryOnCloakDenyList(rot.contextPresell.settings, country)) {
      console.warn("[track.rotator] país sem oferta", { rotatorId, country });
      return sendSafeVisitorPage(res, rot.contextPresell.settings);
    }
    const { device, botMeta: rotBotMeta } = deviceAndBotMeta(userAgent, { headers: req.headers as Record<string, string | string[] | undefined>, ip });
    const pick = await pickRotatorDestination(rotatorId, { country, device });
    if (!pick.ok) {
      if (pick.reason === "policy_block") {
        return sendSafeVisitorPage(res, rot.contextPresell.settings);
      }
      return res.status(503).json({
        error:
          pick.reason === "not_found"
            ? "Rotador indisponível."
            : "Nenhum destino elegível. Configure um URL de recurso ou braços do rotador.",
        code: pick.reason,
      });
    }
    const finalUrl = pick.destinationUrl;

    const armIdForMeta = pick.usedBackup || pick.viaPolicyRedirect ? null : pick.armId;

    const click = await systemPrisma.trackingEvent.create({
      data: {
        userId: rot.userId,
        presellPageId: rot.contextPresellId,
        eventType: "click",
        source,
        medium,
        campaign,
        referrer,
        country: seen.country ?? undefined,
        ipAddress: ip,
        userAgent,
        device,
        metadata: {
          gclid,
          gbraid,
          wbraid,
          fbclid,
          fbp,
          ttclid,
          msclkid,
          utm_term,
          utm_content,
          utm_campaign: campaign || undefined,
          utm_source: utm_source ?? source,
          source,
          medium,
          campaign,
          redirect_to: finalUrl,
          rotator_id: rotatorId,
          rotator_arm_id: armIdForMeta,
          ...(place ? datacenterClickMeta(ip) : reportCloudClickMeta(ip)),
          ...(sub1 ? { sub1 } : {}),
          ...(sub2 ? { sub2 } : {}),
          ...(sub3 ? { sub3 } : {}),
          ...rotPathMetaJson,
          ...rotVoluumMeta,
          ...rotBotMeta,
          ...seen.countryMeta,
        } as Prisma.InputJsonValue,
      },
    });

    notifyTelegramClick(rot.userId, {
      presellTitle: `${rot.name} → ${rot.contextPresell.title}`,
      clickId: click.id,
      campaign,
    });

    const offerNetwork = await affiliateNetworkForRedirect({
      queryNetwork: rotatorNetwork,
      userId: rot.userId,
      presellId: rot.contextPresellId,
    });
    const landed = forwardAdQueryToUrl(finalUrl, {
      gclid,
      gbraid,
      wbraid,
      msclkid,
      fbclid,
      ttclid,
      utm_source,
      utm_medium: medium,
      utm_campaign: campaign,
      utm_term,
      utm_content,
    });
    const redirectTo = appendClickIdToAffiliateUrl(landed, click.id, offerNetwork);
    recordTrackRedirectLatency(performance.now() - t0);
    return res.redirect(302, redirectTo);
  },

  async pixel(req: Request, res: Response) {
    const presellId = req.params.presellId;
    const attr = impressionAttributionFromPixelQuery(req.query);
    const page = await systemPrisma.presellPage.findUnique({ where: { id: presellId } });
    if (!page || page.status !== "published") return res.status(404).end();
    if (!(await assertPresellAllowedOnRequestHost(req, page.userId))) return res.status(404).end();
    const accessCheck = await validateOwnerCanTrack(page.userId);
    if (!accessCheck.ok) return res.status(accessCheck.status).end();

    const ip = extractClientIp(req);
    const userAgent = req.headers["user-agent"] || "";
    const guard = await enforceTrackingRules({
      ownerUserId: page.userId,
      presellPageId: page.id,
      ip,
      userAgent,
      headers: req.headers as Record<string, string | string[] | undefined>,
      channel: "pixel",
      recordedEventType: "other",
    });
    if (!guard.ok) {
      return sendTrackingPixelGif(res);
    }

    const seen = visitorClickPlace(req, ip);
    const { device, botMeta } = deviceAndBotMeta(userAgent, { headers: req.headers as Record<string, string | string[] | undefined>, ip });
    const cloudMeta = seen.place ? datacenterClickMeta(ip) : reportCloudClickMeta(ip);
    const metadataMerged = { ...attr.metadata, ...botMeta, ...seen.countryMeta, ...cloudMeta };
    const metadata =
      Object.keys(metadataMerged).length > 0 ? (metadataMerged as Prisma.InputJsonValue) : undefined;

    await systemPrisma.$transaction([
      systemPrisma.trackingEvent.create({
        data: {
          userId: page.userId,
          presellPageId: page.id,
          eventType: "impression",
          source: attr.source || undefined,
          medium: attr.medium || undefined,
          campaign: attr.campaign || undefined,
          referrer: attr.referrer || undefined,
          country: seen.country ?? undefined,
          ipAddress: ip,
          userAgent,
          device,
          metadata,
        },
      }),
      systemPrisma.presellPage.update({
        where: { id: page.id },
        data: { impressions: { increment: 1 } },
      }),
    ]);

    return sendTrackingPixelGif(res);
  },

  /** BuyGoods Funnel Pixels (Checkout / Lander): `GET /track/funnel/checkout.gif?token=…&subid=…` */
  async funnelStepPixel(req: Request, res: Response) {
    return recordFunnelStepFromPixel(req, res);
  },

  async trackClick(req: Request, res: Response) {
    const parsed = clickSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
    const {
      presell_id,
      source,
      medium,
      campaign,
      referrer,
      gclid,
      gbraid,
      wbraid,
      fbclid,
      fbp,
      ttclid,
      utm_term: bodyUtmTermRaw,
      utm_content: bodyUtmContentRaw,
      msclkid,
      utm_source,
    } = parsed.data;
    const utm_term = realUtmDimensionBody(bodyUtmTermRaw);
    const utm_content = realUtmDimensionBody(bodyUtmContentRaw);

    // Get page owner
    const page = await systemPrisma.presellPage.findUnique({ where: { id: presell_id } });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });
    if (!(await assertPresellAllowedOnRequestHost(req, page.userId))) {
      return res.status(404).json({ error: "Página não encontrada" });
    }
    if (page.status !== "published") return res.status(403).json({ error: "Página indisponível para tracking" });
    const accessCheck = await validateOwnerCanTrack(page.userId);
    if (!accessCheck.ok) return res.status(accessCheck.status).json({ error: accessCheck.message });

    const ip = extractClientIp(req);
    const userAgent = req.headers["user-agent"] || "";
    const guard = await enforceTrackingRules({
      ownerUserId: page.userId,
      presellPageId: presell_id,
      ip,
      userAgent,
      headers: req.headers as Record<string, string | string[] | undefined>,
      channel: "api_click",
      recordedEventType: "click",
    });
    if (!guard.ok) {
      return res.status(guard.status).json({ error: guard.error });
    }

    const seen = visitorClickPlace(req, ip);
    const { device, botMeta } = deviceAndBotMeta(userAgent, { headers: req.headers as Record<string, string | string[] | undefined>, ip });

    const click = await systemPrisma.$transaction(async (tx) => {
      const ev = await tx.trackingEvent.create({
        data: {
          userId: page.userId,
          presellPageId: presell_id,
          eventType: "click",
          source, medium, campaign, referrer,
          country: seen.country ?? undefined,
          ipAddress: ip,
          userAgent,
          device,
          metadata: {
            gclid,
            gbraid,
            wbraid,
            fbclid,
            fbp,
            ttclid,
            msclkid,
            utm_term,
            utm_content,
            utm_source: utm_source ?? source,
            source,
            medium,
            campaign,
            ...botMeta,
            ...seen.countryMeta,
          } as Prisma.InputJsonValue,
        },
      });
      await tx.presellPage.update({
        where: { id: presell_id },
        data: { clicks: { increment: 1 } },
      });
      return ev;
    });

    notifyTelegramClick(page.userId, {
      presellTitle: page.title,
      clickId: click.id,
      campaign,
    });

    res.json({ tracked: true, click_id: click.id });
  },

  async trackImpression(req: Request, res: Response) {
    const parsed = impressionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
    const { presell_id, referrer } = parsed.data;

    const page = await systemPrisma.presellPage.findUnique({ where: { id: presell_id } });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });
    if (!(await assertPresellAllowedOnRequestHost(req, page.userId))) {
      return res.status(404).json({ error: "Página não encontrada" });
    }
    if (page.status !== "published") return res.status(403).json({ error: "Página indisponível para tracking" });
    const accessCheck = await validateOwnerCanTrack(page.userId);
    if (!accessCheck.ok) return res.status(accessCheck.status).json({ error: accessCheck.message });

    const ip = extractClientIp(req);
    const userAgent = req.headers["user-agent"] || "";
    const guard = await enforceTrackingRules({
      ownerUserId: page.userId,
      presellPageId: presell_id,
      ip,
      userAgent,
      headers: req.headers as Record<string, string | string[] | undefined>,
      channel: "impression_api",
      recordedEventType: "other",
    });
    if (!guard.ok) {
      return res.status(guard.status).json({ error: guard.error });
    }

    const seen = visitorClickPlace(req, ip);
    const { device, botMeta } = deviceAndBotMeta(userAgent, { headers: req.headers as Record<string, string | string[] | undefined>, ip });
    const impressionMeta = { ...botMeta, ...seen.countryMeta };

    await systemPrisma.$transaction([
      systemPrisma.trackingEvent.create({
        data: {
          userId: page.userId,
          presellPageId: presell_id,
          eventType: "impression",
          referrer,
          country: seen.country ?? undefined,
          ipAddress: ip,
          userAgent,
          device,
          metadata: Object.keys(impressionMeta).length ? (impressionMeta as Prisma.InputJsonValue) : undefined,
        },
      }),
      systemPrisma.presellPage.update({
        where: { id: presell_id },
        data: { impressions: { increment: 1 } },
      }),
    ]);

    res.json({ tracked: true });
  },

  async trackEvent(req: Request, res: Response) {
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
    const { presell_id, event_type, metadata, value, currency, transaction_id, gclid, fbclid, ttclid, msclkid, source, medium, campaign, referrer } = parsed.data;

    const page = await systemPrisma.presellPage.findUnique({ where: { id: presell_id } });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });
    if (!(await assertPresellAllowedOnRequestHost(req, page.userId))) {
      return res.status(404).json({ error: "Página não encontrada" });
    }
    if (page.status !== "published") return res.status(403).json({ error: "Página indisponível para tracking" });
    const accessCheck = await validateOwnerCanTrack(page.userId);
    if (!accessCheck.ok) return res.status(accessCheck.status).json({ error: accessCheck.message });

    const evIp = extractClientIp(req);
    const evUa = req.headers["user-agent"] || "";
    const evGuard = await enforceTrackingRules({
      ownerUserId: page.userId,
      presellPageId: presell_id,
      ip: evIp,
      userAgent: evUa,
      channel: "track_event",
      recordedEventType: event_type === "click" ? "click" : "other",
    });
    if (!evGuard.ok) {
      return res.status(evGuard.status).json({ error: evGuard.error });
    }

    if (transaction_id) {
      const existing = await systemPrisma.trackingEvent.findFirst({
        where: {
          userId: page.userId,
          presellPageId: presell_id,
          eventType: event_type,
          metadata: { path: ["transaction_id"], equals: transaction_id },
        },
      });
      if (existing) return res.json({ tracked: true, duplicate: true });
    }

    const seen = visitorClickPlace(req, evIp);
    const { device: evDevice, botMeta: evBotMeta } = deviceAndBotMeta(evUa, { headers: req.headers as Record<string, string | string[] | undefined>, ip: evIp });
    await systemPrisma.trackingEvent.create({
      data: {
        userId: page.userId,
        presellPageId: presell_id,
        eventType: event_type,
        source,
        medium,
        campaign,
        referrer,
        country: seen.country ?? undefined,
        device: evDevice,
        metadata: ({
          ...(metadata || {}),
          value,
          currency: currency?.toUpperCase(),
          transaction_id,
          gclid,
          fbclid,
          ttclid,
          msclkid,
          ...evBotMeta,
          ...seen.countryMeta,
        }) as Prisma.InputJsonValue,
        ipAddress: evIp,
        userAgent: evUa,
      },
    });

    // Increment conversions if applicable
    if (["conversion", "sale"].includes(event_type)) {
      await systemPrisma.presellPage.update({
        where: { id: presell_id },
        data: { conversions: { increment: 1 } },
      });
    }

    res.json({ tracked: true });
  },

  async postbackGoogleAds(req: Request, res: Response) {
    const expectedToken = process.env.GOOGLE_POSTBACK_TOKEN;
    let tokenUserId: string | undefined;
    if (expectedToken) {
      const incoming = req.headers["x-postback-token"]?.toString() || req.query.token?.toString();
      if (!incoming || incoming !== expectedToken) {
        return res.status(401).json({ error: "Token de postback inválido" });
      }
    } else {
      const token = req.headers["x-postback-token"]?.toString() || req.query.token?.toString();
      if (!token) return res.status(401).json({ error: "Token de postback obrigatório" });
      const decoded = verifyPostbackToken(token);
      if (!decoded) return res.status(401).json({ error: "Token de postback inválido" });
      tokenUserId = decoded.userId;
    }

    const parsed = z.object({
      presell_id: z.string().optional(),
      presell_slug: z.string().optional(),
      gclid: z.string().min(1),
      conversion_name: z.string().optional(),
      value: z.coerce.number().nonnegative().default(0),
      currency: z.string().min(3).max(3).default("USD"),
      transaction_id: z.string().optional(),
      source: z.string().optional(),
      medium: z.string().optional(),
      campaign: z.string().optional(),
    }).refine((data) => !!data.presell_id || !!data.presell_slug, {
      message: "presell_id ou presell_slug é obrigatório",
      path: ["presell_id"],
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
    }

    const data = parsed.data;
    const page = await systemPrisma.presellPage.findFirst({
      where: data.presell_id ? { id: data.presell_id } : { slug: data.presell_slug },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });
    if (tokenUserId && page.userId !== tokenUserId) return res.status(403).json({ error: "Postback não autorizado para esta página" });

    if (data.transaction_id) {
      const existing = await systemPrisma.trackingEvent.findFirst({
        where: {
          userId: page.userId,
          presellPageId: page.id,
          eventType: "conversion",
          metadata: { path: ["transaction_id"], equals: data.transaction_id },
        },
      });
      if (existing) {
        await logPostback({
          userId: page.userId,
          presellPageId: page.id,
          platform: "google_ads",
          status: "duplicate",
          message: "Evento duplicado por transaction_id",
          payload: req.body,
        });
        return res.json({ tracked: true, duplicate: true });
      }
    }

    const postbackIp = extractClientIp(req);
    const postbackSeen = visitorClickPlace(req, postbackIp);
    const postbackUa = req.headers["user-agent"] || "";
    await systemPrisma.$transaction([
      systemPrisma.trackingEvent.create({
        data: {
          userId: page.userId,
          presellPageId: page.id,
          eventType: "conversion",
          source: data.source || "google_ads",
          medium: data.medium || "cpc",
          campaign: data.campaign,
          country: postbackSeen.country ?? undefined,
          ipAddress: postbackIp,
          userAgent: postbackUa,
          device: detectDevice(postbackUa),
          metadata: {
            gclid: data.gclid,
            conversion_name: data.conversion_name,
            value: data.value,
            currency: data.currency.toUpperCase(),
            transaction_id: data.transaction_id,
            postback_origin: "google_ads",
            ...postbackSeen.countryMeta,
          } as Prisma.InputJsonValue,
        },
      }),
      systemPrisma.presellPage.update({
        where: { id: page.id },
        data: { conversions: { increment: 1 } },
      }),
    ]);

    const orderIdForGoogle = (data.transaction_id && data.transaction_id.trim()) || randomUUID();
    void syncDirectGclidConversionToGoogleAds({
      userId: page.userId,
      presellPageId: page.id,
      gclid: data.gclid,
      conversionValue: data.value,
      currencyCode: data.currency.toUpperCase(),
      orderId: orderIdForGoogle,
      conversionDateTime: new Date(),
    }).catch((err) => console.error("[syncDirectGclidConversionToGoogleAds]", err));

    await logPostback({
      userId: page.userId,
      presellPageId: page.id,
      platform: "google_ads",
      status: "success",
      message: "Postback processado com sucesso",
      payload: req.body,
    });

    return res.json({ tracked: true, google_ads_upload_attempted: true });
  },

  async postbackMicrosoftAds(req: Request, res: Response) {
    const expectedToken = process.env.MICROSOFT_POSTBACK_TOKEN || process.env.GOOGLE_POSTBACK_TOKEN;
    let tokenUserId: string | undefined;
    if (expectedToken) {
      const incoming = req.headers["x-postback-token"]?.toString() || req.query.token?.toString();
      if (!incoming || incoming !== expectedToken) {
        return res.status(401).json({ error: "Token de postback inválido" });
      }
    } else {
      const token = req.headers["x-postback-token"]?.toString() || req.query.token?.toString();
      if (!token) return res.status(401).json({ error: "Token de postback obrigatório" });
      const decoded = verifyPostbackToken(token);
      if (!decoded) return res.status(401).json({ error: "Token de postback inválido" });
      tokenUserId = decoded.userId;
    }

    const parsed = z.object({
      presell_id: z.string().optional(),
      presell_slug: z.string().optional(),
      msclkid: z.string().min(1),
      conversion_name: z.string().optional(),
      value: z.coerce.number().nonnegative().default(0),
      currency: z.string().min(3).max(3).default("USD"),
      transaction_id: z.string().optional(),
      source: z.string().optional(),
      medium: z.string().optional(),
      campaign: z.string().optional(),
    }).refine((data) => !!data.presell_id || !!data.presell_slug, {
      message: "presell_id ou presell_slug é obrigatório",
      path: ["presell_id"],
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
    }

    const data = parsed.data;
    const page = await systemPrisma.presellPage.findFirst({
      where: data.presell_id ? { id: data.presell_id } : { slug: data.presell_slug },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });
    if (tokenUserId && page.userId !== tokenUserId) return res.status(403).json({ error: "Postback não autorizado para esta página" });

    if (data.transaction_id) {
      const existing = await systemPrisma.trackingEvent.findFirst({
        where: {
          userId: page.userId,
          presellPageId: page.id,
          eventType: "conversion",
          metadata: { path: ["transaction_id"], equals: data.transaction_id },
        },
      });
      if (existing) {
        await logPostback({
          userId: page.userId,
          presellPageId: page.id,
          platform: "microsoft_ads",
          status: "duplicate",
          message: "Evento duplicado por transaction_id",
          payload: req.body,
        });
        return res.json({ tracked: true, duplicate: true });
      }
    }

    const msIp = extractClientIp(req);
    const msSeen = visitorClickPlace(req, msIp);
    const msUa = req.headers["user-agent"] || "";
    await systemPrisma.$transaction([
      systemPrisma.trackingEvent.create({
        data: {
          userId: page.userId,
          presellPageId: page.id,
          eventType: "conversion",
          source: data.source || "microsoft_ads",
          medium: data.medium || "cpc",
          campaign: data.campaign,
          country: msSeen.country ?? undefined,
          ipAddress: msIp,
          userAgent: msUa,
          device: detectDevice(msUa),
          metadata: {
            msclkid: data.msclkid,
            conversion_name: data.conversion_name,
            value: data.value,
            currency: data.currency.toUpperCase(),
            transaction_id: data.transaction_id,
            postback_origin: "microsoft_ads",
            ...msSeen.countryMeta,
          } as Prisma.InputJsonValue,
        },
      }),
      systemPrisma.presellPage.update({
        where: { id: page.id },
        data: { conversions: { increment: 1 } },
      }),
    ]);

    await logPostback({
      userId: page.userId,
      presellPageId: page.id,
      platform: "microsoft_ads",
      status: "success",
      message: "Postback processado com sucesso",
      payload: req.body,
    });

    return res.json({ tracked: true });
  },

  async lookupGclid(req: Request, res: Response) {
    const gclid = req.params.gclid;
    if (!req.user?.userId) return res.status(401).json({ error: "Não autenticado" });
    const userId = billingUserId(req);

    const event = await prisma.trackingEvent.findFirst({
      where: {
        userId,
        metadata: { path: ["gclid"], equals: gclid },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        campaign: true,
        source: true,
        medium: true,
        createdAt: true,
        metadata: true,
      },
    });

    if (!event) return res.status(404).json({ error: "GCLID não encontrado" });

    const metadata = (event.metadata || {}) as Record<string, unknown>;
    return res.json({
      id: event.id,
      campaign: event.campaign,
      source: event.source,
      medium: event.medium,
      created_at: event.createdAt.toISOString(),
      gclid,
      utm_term: metadata.utm_term || null,
      utm_content: metadata.utm_content || null,
    });
  },

  /** Script leve para pageview em presells hospedadas em `/p/{uuid}` (async-safe). */
  serveClickoraEmbed(_req: Request, res: Response) {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    /** Cache curto: correção de embed (CORS/gclid) chega rápido aos visitantes Ads. */
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.send(CLICKORA_EMBED_JS);
  },

  /**
   * Importa conversões a partir de CSV (ex.: Google Ads offline).
   * Corpo: texto CSV. Coluna de GCLID detectada pelo cabeçalho ou primeira coluna.
   */
  async conversionsCsv(req: Request, res: Response) {
    const token = req.query.token?.toString();
    const decoded = token ? verifyPostbackToken(token) : null;
    if (!decoded) return res.status(401).json({ error: "Token inválido ou ausente" });

    const userId = decoded.userId;
    const raw = typeof req.body === "string" ? req.body : "";
    if (!raw.trim()) return res.status(400).json({ error: "Corpo CSV vazio" });

    const rows = parseCsvSimple(raw);
    if (rows.length === 0) return res.status(400).json({ error: "Nenhuma linha no CSV" });

    const header = rows[0].map((c) => c.toLowerCase().replace(/"/g, "").trim());
    const hasHeader = header.some((h) => /gclid|google click id|click id/.test(h));
    let gclidCol = header.findIndex((h) => h === "gclid" || h.includes("google click id") || h === "click id");
    if (gclidCol < 0) gclidCol = 0;

    let valueCol = header.findIndex((h) =>
      /conversion value|conv\. value|value|valor/.test(h),
    );
    if (valueCol < 0) valueCol = 1;

    const dataRows = hasHeader ? rows.slice(1) : rows;
    let imported = 0;
    let skipped = 0;

    for (const row of dataRows) {
      const gclid = (row[gclidCol] || "").replace(/^"|"$/g, "").trim();
      if (!gclid) {
        skipped++;
        continue;
      }

      const click = await systemPrisma.trackingEvent.findFirst({
        where: {
          userId,
          eventType: "click",
          metadata: { path: ["gclid"], equals: gclid },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!click?.presellPageId) {
        skipped++;
        continue;
      }

      const page = await systemPrisma.presellPage.findUnique({ where: { id: click.presellPageId } });
      if (!page || page.status !== "published") {
        skipped++;
        continue;
      }

      const accessCheck = await validateOwnerCanTrack(page.userId);
      if (!accessCheck.ok) {
        skipped++;
        continue;
      }

      const transaction_id = `csv_gclid:${gclid}`;
      const existing = await systemPrisma.trackingEvent.findFirst({
        where: {
          userId,
          presellPageId: click.presellPageId,
          eventType: "conversion",
          metadata: { path: ["transaction_id"], equals: transaction_id },
        },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const rawVal = row[valueCol]?.replace(/^"|"$/g, "").trim() ?? "";
      const value = Number.parseFloat(rawVal.replace(",", "."));
      const numVal = Number.isFinite(value) ? value : 0;

      const csvIp = extractClientIp(req);
      const csvSeen = visitorClickPlace(req, csvIp);
      const csvUa = req.headers["user-agent"] || "";
      await systemPrisma.$transaction([
        systemPrisma.trackingEvent.create({
          data: {
            userId,
            presellPageId: click.presellPageId,
            eventType: "conversion",
            source: "google_ads",
            medium: "offline_csv",
            campaign: click.campaign,
            referrer: click.referrer,
            country: csvSeen.country ?? undefined,
            ipAddress: csvIp,
            userAgent: csvUa,
            device: detectDevice(csvUa),
            metadata: {
              gclid,
              value: numVal,
              currency: "USD",
              transaction_id,
              postback_origin: "offline_csv",
              ...csvSeen.countryMeta,
            } as Prisma.InputJsonValue,
          },
        }),
        systemPrisma.presellPage.update({
          where: { id: click.presellPageId },
          data: { conversions: { increment: 1 } },
        }),
      ]);

      await logPostback({
        userId,
        presellPageId: click.presellPageId,
        platform: "google_ads_csv",
        status: "success",
        message: "Conversão importada do CSV",
        payload: { gclid, value: numVal },
      });

      imported++;
    }

    return res.json({ ok: true, imported, skipped });
  },

  /** GET com ?token= — confirma que o token é válido (abrir no browser ou curl -G). A importação continua a ser POST. */
  async conversionsCsvPing(req: Request, res: Response) {
    const token = req.query.token?.toString();
    const decoded = token ? verifyPostbackToken(token) : null;
    if (!decoded) return res.status(401).json({ error: "Token inválido ou ausente" });

    return res.json({
      ok: true,
      message: "Token válido. Para importar conversões, usa POST com o corpo em texto CSV para este mesmo URL.",
      import_method: "POST",
      content_types: ["text/csv", "application/csv", "text/plain"],
    });
  },

  async getPostbackTemplates(req: Request, res: Response) {
    if (!req.user?.userId) return res.status(401).json({ error: "Não autenticado" });
    const userId = billingUserId(req);

    const token = createPostbackToken(userId);
    if (!token) {
      return res.status(503).json({ error: "JWT_SECRET não configurado no servidor." });
    }
    const apiBase = publicApiBaseFromRequest(req);

    res.json({
      token,
      endpoints: {
        google_ads: `${apiBase}/track/postback/google-ads?token=${encodeURIComponent(token)}`,
        microsoft_ads: `${apiBase}/track/postback/microsoft-ads?token=${encodeURIComponent(token)}`,
      },
      examples: {
        google_ads: {
          method: "POST",
          body: {
            presell_id: "<presell_id>",
            gclid: "<gclid>",
            value: 49.9,
            currency: "USD",
            transaction_id: "<tx_id_unico>",
          },
        },
        microsoft_ads: {
          method: "POST",
          body: {
            presell_id: "<presell_id>",
            msclkid: "<msclkid>",
            value: 49.9,
            currency: "USD",
            transaction_id: "<tx_id_unico>",
          },
        },
      },
    });
  },

  /** GET /track/tools/ip-lookup?q= — GeoLite2 (cidade, país, timezone); só IP público com entrada na base. */
  async lookupIp(req: Request, res: Response) {
    if (!req.user?.userId) return res.status(401).json({ error: "Não autenticado" });
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      return res.status(400).json({ error: "Indica um endereço IP (parâmetro q)." });
    }
    const looked = lookupIpForTools(q);
    return res.json({ ok: true, ip: q, ...looked });
  },

  async getPostbackAudit(req: Request, res: Response) {
    if (!req.user?.userId) return res.status(401).json({ error: "Não autenticado" });
    const userId = billingUserId(req);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const platform = req.query.platform?.toString();

    const logs = await prisma.postbackLog.findMany({
      where: {
        userId,
        ...(platform ? { platform } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        platform: true,
        status: true,
        message: true,
        createdAt: true,
        presellPageId: true,
        payload: true,
      },
    });

    return res.json(
      logs.map((l) => ({
        id: l.id,
        platform: l.platform,
        status: l.status,
        message: l.message,
        created_at: l.createdAt.toISOString(),
        presell_id: l.presellPageId,
        payload: l.payload ?? {},
      })),
    );
  },
};

function parseCsvSimple(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    rows.push(
      t.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim()),
    );
  }
  return rows;
}

function detectDevice(ua: string): string {
  return parseUserAgent(ua).device;
}

/** Dispositivo + qualidade (bot / fraud_score) no metadata do clique. */
function deviceAndBotMeta(
  userAgent: string,
  opts?: { headers?: Record<string, string | string[] | undefined>; ip?: string },
): { device: string; botMeta: Record<string, unknown> } {
  const parsed = parseUserAgent(userAgent);
  const q = assessClickQuality({
    userAgent,
    headers: opts?.headers,
    ip: opts?.ip,
  });
  const botMeta: Record<string, unknown> = {
    fraud_score: q.fraud_score,
    fraud_flags: q.fraud_flags,
    browser: parsed.browser,
    os: parsed.os,
    device_label: formatDeviceLabel(parsed),
  };
  if (q.is_bot) {
    botMeta.is_bot = true;
    botMeta.bot_label = q.bot_label;
  }
  if (q.is_proxy_suspect) {
    botMeta.is_proxy_suspect = true;
  }
  if (q.is_bot) {
    return { device: "bot", botMeta };
  }
  return { device: parsed.device, botMeta };
}

async function validateOwnerCanTrack(userId: string): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const owner = await systemPrisma.user.findUnique({
    where: { id: userId },
    include: { subscription: { include: { plan: true } } },
  });

  if (!owner) return { ok: false, status: 404, message: "Usuário proprietário não encontrado" };
  const access = evaluateSubscriptionAccess(owner.subscription);

  if (access.shouldMarkExpired && owner.subscription && owner.subscription.status !== "expired") {
    await systemPrisma.subscription.update({
      where: { id: owner.subscription.id },
      data: { status: "expired" },
    });
  }

  if (!access.allowed) {
    return { ok: false, status: 403, message: "Assinatura do proprietário está inativa." };
  }

  if (owner.subscription?.plan.maxClicksPerMonth != null) {
    const clicksThisMonth = await countPlanClicksThisMonth(userId);
    /**
     * Soft-cap: nunca devolver 429 no track — ads a pagar não podem falhar no redirect.
     * O painel (click_quota) mostra overage; upgrade/alerta comercial trata o excesso.
     */
    if (clicksThisMonth >= owner.subscription.plan.maxClicksPerMonth) {
      console.warn(
        `[track] soft-cap cliques excedido user=${userId} used=${clicksThisMonth} max=${owner.subscription.plan.maxClicksPerMonth}`,
      );
    }
  }

  return { ok: true };
}

async function logPostback(params: {
  userId: string;
  presellPageId?: string;
  platform: string;
  status: string;
  message?: string;
  payload?: unknown;
}) {
  await systemPrisma.postbackLog.create({
    data: {
      userId: params.userId,
      presellPageId: params.presellPageId,
      platform: params.platform,
      status: params.status,
      message: params.message,
      payload: (params.payload || {}) as Prisma.InputJsonValue,
    },
  });
}
