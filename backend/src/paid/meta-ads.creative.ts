/**
 * Criativos Meta (Graph API): Página promovida, upload de imagem (`/adimages`)
 * e vídeo (`/advideos` + miniatura) e montagem do `object_story_spec`.
 */
import { paidLog } from "../lib/paidLog";
import { getPaidMetaAssetsRoot } from "../lib/paidMetaAssetUpload";
import { readPaidAssetFile } from "./paid-asset-file";
import { prisma } from "./paidPrisma";

const GRAPH = "https://graph.facebook.com/v21.0";

export type MetaPageSources = {
  /** `page_id` do payload do pedido de alteração (escolha feita no assistente). */
  payload?: unknown;
  /** Página guardada na ligação Meta do projecto. */
  connection?: string | null;
};

/**
 * Ordem de resolução da Página: escolha do pedido → ligação do projecto →
 * `META_PROMOTED_PAGE_ID` / `META_PAGE_ID` do servidor.
 */
export function resolveMetaPageId(sources: MetaPageSources): string | null {
  const candidates = [
    typeof sources.payload === "string" ? sources.payload : "",
    sources.connection ?? "",
    process.env.META_PROMOTED_PAGE_ID ?? "",
    process.env.META_PAGE_ID ?? "",
  ];
  for (const c of candidates) {
    const v = c.trim();
    if (v) return v;
  }
  return null;
}

/** Ids de Página no Graph são numéricos. */
export function isValidMetaPageId(pageId: string): boolean {
  return /^\d{5,25}$/.test(pageId.trim());
}

export type MetaPageOption = {
  id: string;
  name: string;
  category: string | null;
  /** O utilizador tem a permissão ADVERTISE nesta Página. */
  can_advertise: boolean;
};

export type MetaPagesResult =
  | { ok: true; pages: MetaPageOption[]; selectedPageId: string | null }
  | { ok: false; error: string };

/** Páginas geridas pelo utilizador ligado (Graph `me/accounts`), para escolha no assistente. */
export async function listMetaPagesForProject(projectId: string): Promise<MetaPagesResult> {
  const conn = await prisma.paidAdsMetaConnection.findUnique({ where: { projectId } });
  if (!conn || conn.status !== "connected" || !conn.tokenRef || conn.tokenRef.startsWith("state:")) {
    return { ok: false, error: "Ligue a conta Meta (OAuth) para listar as suas Páginas." };
  }
  const url = new URL(`${GRAPH}/me/accounts`);
  url.searchParams.set("fields", "id,name,category,tasks");
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", conn.tokenRef);
  const res = await fetch(url.toString());
  const j = (await res.json()) as {
    data?: Array<{ id?: string; name?: string; category?: string; tasks?: string[] }>;
    error?: { message?: string; error_user_msg?: string };
  };
  if (!res.ok || j.error) {
    const error = j.error?.error_user_msg ?? j.error?.message ?? `Graph me/accounts (${res.status})`;
    paidLog("error", "meta.pages.list", { projectId, message: error });
    return { ok: false, error };
  }
  const pages: MetaPageOption[] = (j.data ?? [])
    .filter((p): p is { id: string; name?: string } => Boolean(p.id))
    .map((p) => {
      const row = p as { id: string; name?: string; category?: string; tasks?: string[] };
      return {
        id: row.id,
        name: row.name?.trim() || row.id,
        category: row.category?.trim() || null,
        can_advertise: Array.isArray(row.tasks) ? row.tasks.includes("ADVERTISE") : true,
      };
    });
  return { ok: true, pages, selectedPageId: conn.pageId ?? null };
}

export type MetaCreativeAsset =
  | { kind: "image"; imageHash: string }
  | { kind: "video"; videoId: string; thumbnailUrl: string | null };

export type MetaStorySpecInput = {
  pageId: string;
  message: string;
  headline: string;
  description: string;
  link: string;
  ctaType: string;
  asset: MetaCreativeAsset | null;
};

/**
 * `object_story_spec` do criativo: `video_data` quando há vídeo com miniatura,
 * senão `link_data` (com `image_hash` quando existe imagem carregada).
 */
export function buildMetaObjectStorySpec(input: MetaStorySpecInput): Record<string, unknown> {
  const { asset } = input;
  if (asset?.kind === "video" && asset.thumbnailUrl) {
    return {
      page_id: input.pageId,
      video_data: {
        video_id: asset.videoId,
        message: input.message,
        title: input.headline,
        link_description: input.description,
        image_url: asset.thumbnailUrl,
        call_to_action: { type: input.ctaType, value: { link: input.link } },
      },
    };
  }
  const linkData: Record<string, unknown> = {
    message: input.message,
    name: input.headline,
    description: input.description,
    link: input.link,
    call_to_action: { type: input.ctaType },
  };
  if (asset?.kind === "image") {
    linkData.image_hash = asset.imageHash;
  }
  return { page_id: input.pageId, link_data: linkData };
}

type GraphJson = {
  id?: string;
  images?: Record<string, { hash?: string; url?: string }>;
  data?: Array<{ uri?: string; is_preferred?: boolean }>;
  error?: { message?: string; error_user_msg?: string };
};

function graphError(j: GraphJson, status: number, fallback: string): string {
  return j.error?.error_user_msg ?? j.error?.message ?? `${fallback} (Graph ${status})`;
}

async function uploadMetaImage(
  actPath: string,
  token: string,
  file: { bytes: Buffer; fileName: string },
): Promise<{ ok: true; imageHash: string } | { ok: false; error: string }> {
  const url = new URL(`${GRAPH}/${actPath}adimages`);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      bytes: file.bytes.toString("base64"),
      name: file.fileName,
    }),
  });
  const j = (await res.json()) as GraphJson;
  const hash = j.images ? Object.values(j.images).find((i) => i?.hash)?.hash : undefined;
  if (!res.ok || j.error || !hash) {
    return { ok: false, error: graphError(j, res.status, "Falha ao carregar a imagem no Meta") };
  }
  return { ok: true, imageHash: hash };
}

const THUMBNAIL_ATTEMPTS = 4;
const THUMBNAIL_DELAY_MS = 1500;

/** A miniatura só existe depois de o Meta processar o vídeo — daí as tentativas espaçadas. */
async function metaVideoThumbnailUrl(
  videoId: string,
  token: string,
): Promise<string | null> {
  for (let attempt = 0; attempt < THUMBNAIL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, THUMBNAIL_DELAY_MS));
    }
    const url = new URL(`${GRAPH}/${videoId}/thumbnails`);
    url.searchParams.set("fields", "uri,is_preferred");
    url.searchParams.set("access_token", token);
    const res = await fetch(url.toString());
    const j = (await res.json()) as GraphJson;
    if (!res.ok || j.error) continue;
    const rows = j.data ?? [];
    const preferred = rows.find((t) => t.is_preferred && t.uri) ?? rows.find((t) => t.uri);
    if (preferred?.uri) return preferred.uri;
  }
  return null;
}

async function uploadMetaVideo(
  actPath: string,
  token: string,
  file: { bytes: Buffer; fileName: string; mime: string },
): Promise<{ ok: true; videoId: string; thumbnailUrl: string | null } | { ok: false; error: string }> {
  const url = new URL(`${GRAPH}/${actPath}advideos`);
  url.searchParams.set("access_token", token);
  const form = new FormData();
  form.append("name", file.fileName);
  form.append("source", new Blob([new Uint8Array(file.bytes)], { type: file.mime }), file.fileName);
  const res = await fetch(url.toString(), { method: "POST", body: form });
  const j = (await res.json()) as GraphJson;
  if (!res.ok || j.error || !j.id) {
    return { ok: false, error: graphError(j, res.status, "Falha ao carregar o vídeo no Meta") };
  }
  const videoId = j.id;
  return { ok: true, videoId, thumbnailUrl: await metaVideoThumbnailUrl(videoId, token) };
}

export type MetaResolveAssetResult =
  | { ok: true; asset: MetaCreativeAsset | null }
  | { ok: false; error: string };

/**
 * Carrega o criativo do assistente para a conta Meta. Sem ficheiro (ou com ficheiro
 * já ausente do disco) devolve `asset: null` e o anúncio segue como ligação simples.
 */
export async function resolveMetaCreativeAsset(
  projectId: string,
  actPath: string,
  token: string,
  assetPath: unknown,
): Promise<MetaResolveAssetResult> {
  const file = readPaidAssetFile(getPaidMetaAssetsRoot(), projectId, assetPath);
  if (!file) {
    if (assetPath) {
      paidLog("warn", "meta.creative.asset_missing", { projectId, assetPath: String(assetPath) });
    }
    return { ok: true, asset: null };
  }
  if (file.kind === "image") {
    const up = await uploadMetaImage(actPath, token, file);
    if (!up.ok) {
      paidLog("error", "meta.creative.image_upload", { projectId, message: up.error });
      return { ok: false, error: up.error };
    }
    return { ok: true, asset: { kind: "image", imageHash: up.imageHash } };
  }
  const up = await uploadMetaVideo(actPath, token, file);
  if (!up.ok) {
    paidLog("error", "meta.creative.video_upload", { projectId, message: up.error });
    return { ok: false, error: up.error };
  }
  if (!up.thumbnailUrl) {
    paidLog("warn", "meta.creative.video_thumbnail_pending", { projectId, videoId: up.videoId });
  }
  return {
    ok: true,
    asset: { kind: "video", videoId: up.videoId, thumbnailUrl: up.thumbnailUrl },
  };
}
