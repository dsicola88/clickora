/**
 * Criativos TikTok (Marketing API v1.3): identidade do anunciante, upload de vídeo/imagem
 * (`file/video/ad/upload/`, `file/image/ad/upload/`) e criação do anúncio (`ad/create/`).
 */
import crypto from "crypto";

import { paidLog } from "../lib/paidLog";
import { getPaidTiktokAssetsRoot } from "../lib/paidTiktokAssetUpload";
import { readPaidAssetFile } from "./paid-asset-file";
import {
  tiktokApiGetWithTokenRetry,
  tiktokApiPostWithTokenRetry,
  tiktokApiUploadWithTokenRetry,
} from "./tiktok-oauth.api";

export type TikTokCreativeSource = {
  /** `video_id` já existente na biblioteca do advertiser. */
  videoId: string | null;
  /** URL pública para `UPLOAD_BY_URL`. */
  videoUrl: string | null;
  /** `image_id`s já existentes (capa do vídeo ou criativo de imagem). */
  imageIds: string[];
  imageUrl: string | null;
  /** Ficheiro carregado pelo assistente (`<projectId>/<hex>.<ext>`). */
  assetPath: string | null;
  adText: string | null;
  landingUrl: string | null;
  callToAction: string | null;
  displayName: string | null;
  identityId: string | null;
};

function str(p: Record<string, unknown> | undefined, ...keys: string[]): string | null {
  if (!p) return null;
  for (const k of keys) {
    const v = p[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function strList(p: Record<string, unknown> | undefined, key: string): string[] {
  const v = p?.[key];
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

/** Primeiro hook do plano IA (`plan.hooks.texts`) quando existir. */
function firstPlanHook(crPayload: Record<string, unknown> | undefined): string | null {
  const plan = crPayload?.["plan"];
  if (!plan || typeof plan !== "object") return null;
  const hooks = (plan as { hooks?: unknown }).hooks;
  if (!hooks || typeof hooks !== "object") return null;
  const texts = (hooks as { texts?: unknown }).texts;
  if (!Array.isArray(texts)) return null;
  const first = texts.find((t): t is string => typeof t === "string" && t.trim().length > 0);
  return first ? first.trim() : null;
}

export function extractTikTokCreativeSource(
  crPayload: Record<string, unknown> | undefined,
): TikTokCreativeSource {
  const singleImageId = str(crPayload, "image_id", "tiktok_image_id");
  const imageIds = strList(crPayload, "image_ids");
  return {
    videoId: str(crPayload, "video_id", "tiktok_video_id"),
    videoUrl: str(crPayload, "video_url", "video_asset_url"),
    imageIds: imageIds.length ? imageIds : singleImageId ? [singleImageId] : [],
    imageUrl: str(crPayload, "image_url", "image_asset_url"),
    assetPath: str(crPayload, "video_asset_path", "asset_path"),
    adText:
      str(crPayload, "ad_text", "primary_text") ?? firstPlanHook(crPayload),
    landingUrl: str(
      crPayload,
      "landing_url",
      "landing_page_url",
      "final_url",
      "destination_url",
    ),
    callToAction: str(crPayload, "call_to_action"),
    displayName: str(crPayload, "display_name"),
    identityId: str(crPayload, "identity_id"),
  };
}

/** Há material suficiente para criar o anúncio (vídeo ou imagem)? */
export function hasTikTokCreativeSource(src: TikTokCreativeSource): boolean {
  return Boolean(
    src.videoId || src.videoUrl || src.imageIds.length || src.imageUrl || src.assetPath,
  );
}

/** `call_to_action` compatível com o objectivo remoto da campanha. */
export function tiktokCallToActionFromObjective(objectiveType: string): string {
  switch (objectiveType.toUpperCase()) {
    case "VIDEO_VIEWS":
      return "WATCH_NOW";
    case "LEAD_GENERATION":
      return "SIGN_UP";
    case "CONVERSIONS":
      return "SHOP_NOW";
    case "APP_INSTALL":
      return "DOWNLOAD_NOW";
    default:
      return "LEARN_MORE";
  }
}

/** `ad_text` TikTok: linha única, sem chavetas/emoji de controlo, máx. 100 caracteres. */
export function sanitizeTikTokAdText(text: string): string {
  return text
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[{}]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 100);
}

export type TikTokAdCreativeInput = {
  adName: string;
  identityId: string;
  videoId: string | null;
  /** Vídeo: capa; imagem: o próprio criativo. */
  imageIds: string[];
  adText: string;
  callToAction: string;
  landingPageUrl: string;
  displayName: string;
};

export function buildTikTokAdCreative(input: TikTokAdCreativeInput): Record<string, unknown> {
  const creative: Record<string, unknown> = {
    ad_name: input.adName.slice(0, 512),
    identity_type: "CUSTOMIZED_USER",
    identity_id: input.identityId,
    ad_format: input.videoId ? "SINGLE_VIDEO" : "SINGLE_IMAGE",
    ad_text: sanitizeTikTokAdText(input.adText),
    call_to_action: input.callToAction,
    landing_page_url: input.landingPageUrl,
    display_name: input.displayName.slice(0, 40),
    operation_status: "ENABLE",
  };
  if (input.videoId) creative.video_id = input.videoId;
  if (input.imageIds.length) creative.image_ids = input.imageIds.slice(0, 1);
  return creative;
}

type IdentityListData = {
  identity_list?: Array<{ identity_id?: string; identity_type?: string; display_name?: string }>;
};

export type TikTokIdentityResult =
  | { ok: true; identityId: string }
  | { ok: false; error: string };

/**
 * Devolve a identidade `CUSTOMIZED_USER` do advertiser: a preferida (payload / `TIKTOK_IDENTITY_ID`),
 * a primeira já existente na conta, ou uma nova criada em `identity/create/`.
 */
export async function ensureTikTokIdentity(
  projectId: string,
  advertiserId: string,
  displayName: string,
  preferredIdentityId?: string | null,
): Promise<TikTokIdentityResult> {
  const preferred = preferredIdentityId?.trim() || process.env.TIKTOK_IDENTITY_ID?.trim();
  if (preferred) return { ok: true, identityId: preferred };

  const list = await tiktokApiGetWithTokenRetry<IdentityListData>(projectId, "identity/get/", {
    advertiser_id: advertiserId,
    identity_type: "CUSTOMIZED_USER",
    page: 1,
    page_size: 20,
  });
  if (list.code === 0) {
    const existing = list.data?.identity_list?.find((i) => i.identity_id);
    if (existing?.identity_id) return { ok: true, identityId: String(existing.identity_id) };
  } else {
    paidLog("warn", "tiktok.identity.get", {
      projectId,
      code: list.code,
      message: list.message,
      requestId: list.request_id,
    });
  }

  const created = await tiktokApiPostWithTokenRetry<{ identity_id?: string }>(
    projectId,
    "identity/create/",
    {
      advertiser_id: advertiserId,
      display_name: displayName.slice(0, 100) || "Clickora",
    },
  );
  if (created.code !== 0 || !created.data?.identity_id) {
    paidLog("error", "tiktok.identity.create", {
      projectId,
      code: created.code,
      message: created.message,
      requestId: created.request_id,
    });
    return {
      ok: false,
      error:
        created.message ||
        `Não foi possível obter uma identidade TikTok para o anúncio (code ${created.code}).`,
    };
  }
  return { ok: true, identityId: String(created.data.identity_id) };
}

type VideoUploadData = Array<{ video_id?: string; poster_url?: string }>;
type ImageUploadData = { image_id?: string; image_url?: string };

function firstVideo(data: VideoUploadData | undefined): { videoId: string; posterUrl: string | null } | null {
  const row = Array.isArray(data) ? data.find((r) => r?.video_id) : null;
  if (!row?.video_id) return null;
  return { videoId: String(row.video_id), posterUrl: row.poster_url ? String(row.poster_url) : null };
}

async function uploadVideoByFile(
  projectId: string,
  advertiserId: string,
  file: { bytes: Buffer; fileName: string; mime: string },
) {
  const form = new FormData();
  form.append("advertiser_id", advertiserId);
  form.append("upload_type", "UPLOAD_BY_FILE");
  form.append("file_name", file.fileName);
  form.append("video_signature", crypto.createHash("md5").update(file.bytes).digest("hex"));
  form.append("video_file", new Blob([new Uint8Array(file.bytes)], { type: file.mime }), file.fileName);
  return tiktokApiUploadWithTokenRetry<VideoUploadData>(projectId, "file/video/ad/upload/", form);
}

async function uploadImageByFile(
  projectId: string,
  advertiserId: string,
  file: { bytes: Buffer; fileName: string; mime: string },
) {
  const form = new FormData();
  form.append("advertiser_id", advertiserId);
  form.append("upload_type", "UPLOAD_BY_FILE");
  form.append("file_name", file.fileName);
  form.append("image_signature", crypto.createHash("md5").update(file.bytes).digest("hex"));
  form.append("image_file", new Blob([new Uint8Array(file.bytes)], { type: file.mime }), file.fileName);
  return tiktokApiUploadWithTokenRetry<ImageUploadData>(projectId, "file/image/ad/upload/", form);
}

/** Capa do vídeo: `poster_url` do upload ou de `file/video/ad/info/`, carregada como imagem. */
async function videoPosterImageId(
  projectId: string,
  advertiserId: string,
  videoId: string,
  posterUrl: string | null,
): Promise<string | null> {
  let url = posterUrl;
  if (!url) {
    const info = await tiktokApiGetWithTokenRetry<Array<{ poster_url?: string }>>(
      projectId,
      "file/video/ad/info/",
      { advertiser_id: advertiserId, video_ids: [videoId] },
    );
    if (info.code !== 0) {
      paidLog("warn", "tiktok.video.info", {
        projectId,
        videoId,
        code: info.code,
        message: info.message,
        requestId: info.request_id,
      });
      return null;
    }
    const row = Array.isArray(info.data) ? info.data.find((r) => r?.poster_url) : null;
    url = row?.poster_url ? String(row.poster_url) : null;
  }
  if (!url) return null;
  const res = await tiktokApiPostWithTokenRetry<ImageUploadData>(
    projectId,
    "file/image/ad/upload/",
    { advertiser_id: advertiserId, upload_type: "UPLOAD_BY_URL", image_url: url },
  );
  if (res.code !== 0 || !res.data?.image_id) {
    paidLog("warn", "tiktok.image.upload_poster", {
      projectId,
      videoId,
      code: res.code,
      message: res.message,
      requestId: res.request_id,
    });
    return null;
  }
  return String(res.data.image_id);
}

export type TikTokResolvedCreative = { videoId: string | null; imageIds: string[] };

export type TikTokResolveCreativeResult =
  | { ok: true; creative: TikTokResolvedCreative }
  | { ok: false; error: string };

/**
 * Converte o material do payload em ids TikTok: usa ids existentes, carrega por URL
 * ou envia o ficheiro local do assistente; para vídeo garante também a imagem de capa.
 */
export async function resolveTikTokCreativeAssets(
  projectId: string,
  advertiserId: string,
  src: TikTokCreativeSource,
): Promise<TikTokResolveCreativeResult> {
  const localFile = readPaidAssetFile(getPaidTiktokAssetsRoot(), projectId, src.assetPath);
  if (src.assetPath && !localFile) {
    paidLog("warn", "tiktok.creative.asset_missing", { projectId, assetPath: src.assetPath });
  }

  let videoId = src.videoId;
  let posterUrl: string | null = null;

  if (!videoId && src.videoUrl) {
    const res = await tiktokApiPostWithTokenRetry<VideoUploadData>(
      projectId,
      "file/video/ad/upload/",
      { advertiser_id: advertiserId, upload_type: "UPLOAD_BY_URL", video_url: src.videoUrl },
    );
    const up = res.code === 0 ? firstVideo(res.data) : null;
    if (!up) {
      paidLog("error", "tiktok.video.upload_by_url", {
        projectId,
        code: res.code,
        message: res.message,
        requestId: res.request_id,
      });
      return {
        ok: false,
        error: res.message || `Falha ao carregar o vídeo por URL no TikTok (code ${res.code}).`,
      };
    }
    videoId = up.videoId;
    posterUrl = up.posterUrl;
  }

  if (!videoId && localFile?.kind === "video") {
    const res = await uploadVideoByFile(projectId, advertiserId, localFile);
    const up = res.code === 0 ? firstVideo(res.data) : null;
    if (!up) {
      paidLog("error", "tiktok.video.upload_by_file", {
        projectId,
        code: res.code,
        message: res.message,
        requestId: res.request_id,
      });
      return {
        ok: false,
        error: res.message || `Falha ao carregar o vídeo no TikTok (code ${res.code}).`,
      };
    }
    videoId = up.videoId;
    posterUrl = up.posterUrl;
  }

  const imageIds: string[] = [];
  if (src.imageIds.length) {
    imageIds.push(...src.imageIds);
  } else if (src.imageUrl) {
    const res = await tiktokApiPostWithTokenRetry<ImageUploadData>(
      projectId,
      "file/image/ad/upload/",
      { advertiser_id: advertiserId, upload_type: "UPLOAD_BY_URL", image_url: src.imageUrl },
    );
    if (res.code !== 0 || !res.data?.image_id) {
      paidLog("error", "tiktok.image.upload_by_url", {
        projectId,
        code: res.code,
        message: res.message,
        requestId: res.request_id,
      });
      return {
        ok: false,
        error: res.message || `Falha ao carregar a imagem por URL no TikTok (code ${res.code}).`,
      };
    }
    imageIds.push(String(res.data.image_id));
  } else if (localFile?.kind === "image") {
    const res = await uploadImageByFile(projectId, advertiserId, localFile);
    if (res.code !== 0 || !res.data?.image_id) {
      paidLog("error", "tiktok.image.upload_by_file", {
        projectId,
        code: res.code,
        message: res.message,
        requestId: res.request_id,
      });
      return {
        ok: false,
        error: res.message || `Falha ao carregar a imagem no TikTok (code ${res.code}).`,
      };
    }
    imageIds.push(String(res.data.image_id));
  }

  if (videoId && !imageIds.length) {
    const cover = await videoPosterImageId(projectId, advertiserId, videoId, posterUrl);
    if (cover) imageIds.push(cover);
  }

  if (!videoId && !imageIds.length) {
    return {
      ok: false,
      error:
        "Sem material utilizável para o anúncio TikTok: carregue um vídeo (MP4/MOV) ou imagem no assistente.",
    };
  }

  return { ok: true, creative: { videoId, imageIds } };
}

export type TikTokCreateAdResult = { ok: true; adId: string } | { ok: false; error: string };

type AdCreateData = { ad_ids?: string[]; creatives?: Array<{ ad_id?: string }> };

export async function createTikTokAd(
  projectId: string,
  params: { advertiserId: string; adgroupId: string; creative: Record<string, unknown> },
): Promise<TikTokCreateAdResult> {
  const res = await tiktokApiPostWithTokenRetry<AdCreateData>(projectId, "ad/create/", {
    advertiser_id: params.advertiserId,
    adgroup_id: params.adgroupId,
    creatives: [params.creative],
  });
  const adId = res.data?.ad_ids?.[0] ?? res.data?.creatives?.[0]?.ad_id;
  if (res.code !== 0 || !adId) {
    paidLog("error", "tiktok.ad.create", {
      projectId,
      adgroupId: params.adgroupId,
      code: res.code,
      message: res.message,
      requestId: res.request_id,
    });
    return {
      ok: false,
      error: res.message || `Falha ao criar o anúncio TikTok (code ${res.code}).`,
    };
  }
  return { ok: true, adId: String(adId) };
}
