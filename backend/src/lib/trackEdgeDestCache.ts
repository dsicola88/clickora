/**
 * Cache de destino (hoplink) para path de tracking mais rápido na origem
 * e para o worker edge aquecer sem bater na BD a cada clique.
 */
import Redis from "ioredis";
import { Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";
import { resolveEffectiveOfferForPresell } from "./offerValidation";
import { evaluateSubscriptionAccess } from "./subscription";
import { shouldEnforceComplianceServeBlock } from "../compliance/evaluate";

const MEMORY_TTL_MS = 60_000;
const REDIS_TTL_SEC = 120;
const KEY = (id: string) => `track:edge:dest:v2:${id}`;

type DestPayload = {
  destination: string;
  status: string;
  userId: string;
  /** Plataforma da campanha (appendClickId no edge = origin). */
  network: string | null;
  /** Cloak geo deny — edge falha para origin se CF-IPCountry estiver na lista. */
  enterpriseCloak: boolean;
  cloakGeoDeny: string | null;
  updatedAt: number;
};

const memory = new Map<string, { exp: number; value: DestPayload }>();

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    redis = null;
    return null;
  }
  try {
    redis = new Redis(url, { maxRetriesPerRequest: 1, enableReadyCheck: false, lazyConnect: true });
    redis.on("error", () => {
      /* rate limit / cache best-effort */
    });
    return redis;
  } catch {
    redis = null;
    return null;
  }
}

function memoryGet(id: string): DestPayload | null {
  const hit = memory.get(id);
  if (!hit) return null;
  if (Date.now() > hit.exp) {
    memory.delete(id);
    return null;
  }
  return hit.value;
}

function memorySet(id: string, value: DestPayload) {
  memory.set(id, { exp: Date.now() + MEMORY_TTL_MS, value });
}

export async function invalidateTrackEdgeDest(presellId: string): Promise<void> {
  memory.delete(presellId);
  const client = getRedis();
  if (!client) return;
  try {
    if (client.status !== "ready") await client.connect().catch(() => undefined);
    await client.del(KEY(presellId));
  } catch {
    /* ignore */
  }
}

export async function getCachedTrackEdgeDest(presellId: string): Promise<DestPayload | null> {
  const mem = memoryGet(presellId);
  if (mem) return mem;
  const client = getRedis();
  if (client) {
    try {
      if (client.status !== "ready") await client.connect().catch(() => undefined);
      const raw = await client.get(KEY(presellId));
      if (raw) {
        const parsed = JSON.parse(raw) as DestPayload;
        // v2 exige network/cloak; descartar payload antigo sem esses campos.
        if (
          parsed?.destination &&
          parsed.status &&
          typeof parsed.enterpriseCloak === "boolean" &&
          ("network" in parsed)
        ) {
          memorySet(presellId, parsed);
          return parsed;
        }
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

async function putCache(presellId: string, value: DestPayload): Promise<void> {
  memorySet(presellId, value);
  const client = getRedis();
  if (!client) return;
  try {
    if (client.status !== "ready") await client.connect().catch(() => undefined);
    await client.set(KEY(presellId), JSON.stringify(value), "EX", REDIS_TTL_SEC);
  } catch {
    /* ignore */
  }
}

type EdgePageRow = {
  id: string;
  userId: string;
  status: string;
  type: string;
  content: Prisma.JsonValue | null;
  tracking: Prisma.JsonValue | null;
  settings: Prisma.JsonValue | null;
  complianceGate: string;
  offer?: {
    id: string;
    hoplinkUrl: string;
    backupHoplinkUrl: string | null;
    network: string | null;
    validationStatus: string;
    isActive: boolean;
  } | null;
  user: { subscription: { status: string; endsAt: Date | null; plan: unknown } | null } | null;
};

async function loadEdgePage(presellId: string): Promise<EdgePageRow | null> {
  try {
    return (await systemPrisma.presellPage.findUnique({
      where: { id: presellId },
      select: {
        id: true,
        userId: true,
        status: true,
        type: true,
        content: true,
        tracking: true,
        settings: true,
        complianceGate: true,
        offer: {
          select: {
            id: true,
            hoplinkUrl: true,
            backupHoplinkUrl: true,
            network: true,
            validationStatus: true,
            isActive: true,
          },
        },
        user: { include: { subscription: { include: { plan: true } } } },
      },
    })) as EdgePageRow | null;
  } catch (e) {
    if (
      !(e instanceof Prisma.PrismaClientKnownRequestError) ||
      (e.code !== "P2021" && e.code !== "P2022")
    ) {
      throw e;
    }
    return (await systemPrisma.presellPage.findUnique({
      where: { id: presellId },
      select: {
        id: true,
        userId: true,
        status: true,
        type: true,
        content: true,
        tracking: true,
        settings: true,
        complianceGate: true,
        user: { include: { subscription: { include: { plan: true } } } },
      },
    })) as EdgePageRow | null;
  }
}

/** Resolve + cacheia destino público para edge/worker. */
export async function resolveTrackEdgeDest(presellId: string): Promise<DestPayload | null> {
  const cached = await getCachedTrackEdgeDest(presellId);
  if (cached) return cached;

  const page = await loadEdgePage(presellId);
  if (!page) return null;
  if (page.status !== "published") return null;
  if (
    shouldEnforceComplianceServeBlock({
      gate: page.complianceGate as never,
      pageType: page.type,
    })
  ) {
    return null;
  }
  const access = evaluateSubscriptionAccess(page.user?.subscription as never);
  if (!access.allowed) return null;
  const resolved = resolveEffectiveOfferForPresell({
    offer: page.offer ?? null,
    content: page.content,
    tracking: page.tracking,
  });
  if (!resolved.ok) return null;
  const destination = resolved.destination;
  const camp = await systemPrisma.affiliateCampaign.findFirst({
    where: { userId: page.userId, presellId: page.id, platform: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { platform: true },
  });
  const settings =
    page.settings && typeof page.settings === "object" && !Array.isArray(page.settings)
      ? (page.settings as Record<string, unknown>)
      : {};
  const enterpriseCloak = settings.enterpriseCloak === true || settings.enterpriseCloak === "true";
  const cloakGeoDeny =
    typeof settings.cloakGeoDeny === "string" && settings.cloakGeoDeny.trim()
      ? settings.cloakGeoDeny.trim()
      : null;
  const payload: DestPayload = {
    destination,
    status: page.status,
    userId: page.userId,
    network: camp?.platform?.trim() || resolved.network || null,
    enterpriseCloak,
    cloakGeoDeny,
    updatedAt: Date.now(),
  };
  await putCache(presellId, payload);
  return payload;
}
