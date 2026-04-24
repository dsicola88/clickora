import type { PrismaClient } from "@prisma/client";
import { getTenantContext } from "./tenantContext";
import { TenantIsolationError } from "./tenantErrors";
import { logCrossTenantBlocked, logTenantViolation } from "./tenantLogging";

/**
 * Modelos com coluna `user_id` (tenant = dono da linha).
 * Ao adicionar modelo novo com `userId` em schema.prisma, incluir aqui ou o cliente tenant não filtra.
 */
const USER_ID_MODELS = [
  "presellPage",
  "trackingEvent",
  "postbackLog",
  "conversion",
  "blacklistedIp",
  "whitelistedIp",
  "subscription",
  "customDomain",
  "userRole",
] as const;

const MUTATING_PLAN_OPS = new Set(["create", "createMany", "update", "updateMany", "delete", "deleteMany", "upsert"]);

function requireTenantId(): string {
  const ctx = getTenantContext();
  if (!ctx?.tenantId) {
    logTenantViolation("query_without_tenant_context");
    throw new TenantIsolationError(
      "Contexto de tenant obrigatório. Operações sem tenant só são permitidas via systemPrisma ou prismaAdmin (camadas explícitas).",
    );
  }
  return ctx.tenantId;
}

function mergeWhereUserId(args: Record<string, unknown>, tenantId: string): Record<string, unknown> {
  const w = args.where;
  if (w === undefined || w === null) {
    return { ...args, where: { userId: tenantId } };
  }
  return { ...args, where: { AND: [w as object, { userId: tenantId }] } };
}

/**
 * `subscription` tem `findUnique` só por `id` ou `userId` — não aceita `AND` no `where`.
 * Isto alinha com `prisma.subscription.findUnique({ where: { userId } })` nos controladores.
 */
function mergeSubscriptionFindUnique(args: Record<string, unknown>, tenantId: string): Record<string, unknown> {
  const w = args.where as Record<string, unknown> | undefined | null;
  if (w === undefined || w === null) {
    return { ...args, where: { userId: tenantId } };
  }
  if (typeof w === "object" && w !== null && Object.keys(w).length === 1 && "userId" in w) {
    const uid = w.userId;
    if (typeof uid === "string" && uid !== tenantId) {
      logCrossTenantBlocked({ model: "Subscription", tenantId, attemptedResource: uid });
      throw new TenantIsolationError("Acesso negado: recurso de outro tenant.");
    }
    return { ...args, where: { userId: tenantId } };
  }
  return mergeWhereUserId(args, tenantId);
}

function mergeWhereUserIdEqualsId(args: Record<string, unknown>, tenantId: string): Record<string, unknown> {
  const w = args.where;
  if (w === undefined || w === null) {
    return { ...args, where: { id: tenantId } };
  }
  // User.findUnique só aceita `id` | `email` | `googleId` no topo — não `AND`.
  // Quando o caller já filtra por `id` igual ao tenant, não duplicar em AND.
  if (typeof w === "object" && w !== null && Object.keys(w as object).length === 1 && "id" in w) {
    const wid = (w as { id: unknown }).id;
    if (typeof wid === "string" && wid === tenantId) {
      return { ...args, where: { id: tenantId } };
    }
  }
  return { ...args, where: { AND: [w as object, { id: tenantId }] } };
}

function injectCreateUserId(args: Record<string, unknown>, tenantId: string): Record<string, unknown> {
  const data = (args.data ?? {}) as Record<string, unknown>;
  return { ...args, data: { ...data, userId: tenantId } };
}

function injectCreateManyUserId(args: Record<string, unknown>, tenantId: string): Record<string, unknown> {
  const data = args.data;
  if (Array.isArray(data)) {
    return {
      ...args,
      data: data.map((row) => ({ ...(row as object), userId: tenantId })),
    };
  }
  if (data && typeof data === "object") {
    return { ...args, data: { ...(data as object), userId: tenantId } };
  }
  return { ...args, data: { userId: tenantId } };
}

function mergeUpdateUserId(args: Record<string, unknown>, tenantId: string): Record<string, unknown> {
  const merged = mergeWhereUserId(args, tenantId);
  const data = args.data as Record<string, unknown> | undefined;
  if (data && typeof data === "object") {
    const { userId: _ignored, ...rest } = data;
    merged.data = { ...rest, userId: tenantId };
  }
  return merged;
}

/**
 * O Prisma `upsert` exige `where` como um único filtro de constraint única.
 * Não pode ser `{ AND: [ { userId_ipAddress: … }, { userId } ] }` — gera PrismaClientValidationError
 * (em produção o errorHandler devolve "Pedido inválido.").
 */
function mergeUpsertUserId(args: Record<string, unknown>, tenantId: string): Record<string, unknown> {
  const w = args.where as Record<string, unknown> | undefined | null;
  if (w && typeof w === "object" && !Array.isArray(w)) {
    if ("userId_ipAddress" in w) {
      const compound = w.userId_ipAddress as Record<string, unknown> | undefined;
      if (!compound || typeof compound !== "object") {
        throw new TenantIsolationError("Upsert inválido: userId_ipAddress mal formado.");
      }
      const uid = compound.userId;
      if (typeof uid === "string" && uid !== tenantId) {
        logCrossTenantBlocked({
          model: "userId_ipAddress upsert",
          tenantId,
          attemptedResource: uid,
        });
        throw new TenantIsolationError("Acesso negado: recurso de outro tenant.");
      }
      const ip = compound.ipAddress;
      if (typeof ip !== "string") {
        throw new TenantIsolationError("Upsert inválido: ipAddress em falta.");
      }
      const create = (args.create ?? {}) as Record<string, unknown>;
      const update = args.update as Record<string, unknown> | undefined;
      const { userId: _c, ...createRest } = create;
      const base: Record<string, unknown> = {
        ...args,
        where: { userId_ipAddress: { userId: tenantId, ipAddress: ip } },
        create: { ...createRest, userId: tenantId },
      };
      if (update && typeof update === "object") {
        const { userId: _u, ...rest } = update;
        base.update = { ...rest, userId: tenantId };
      } else {
        base.update = { userId: tenantId };
      }
      return base;
    }
    const keys = Object.keys(w);
    if (keys.length === 1 && keys[0] === "userId") {
      const uid = w.userId;
      if (typeof uid === "string" && uid !== tenantId) {
        logCrossTenantBlocked({ model: "subscription upsert", tenantId, attemptedResource: uid });
        throw new TenantIsolationError("Acesso negado: recurso de outro tenant.");
      }
      const create = (args.create ?? {}) as Record<string, unknown>;
      const update = args.update as Record<string, unknown> | undefined;
      const { userId: _c, ...createRest } = create;
      const base: Record<string, unknown> = {
        ...args,
        where: { userId: tenantId },
        create: { ...createRest, userId: tenantId },
      };
      if (update && typeof update === "object") {
        const { userId: _u, ...rest } = update;
        base.update = { ...rest, userId: tenantId };
      } else {
        base.update = { userId: tenantId };
      }
      return base;
    }
  }

  const mergedWhere = mergeWhereUserId(args, tenantId);
  const create = (args.create ?? {}) as Record<string, unknown>;
  const update = args.update as Record<string, unknown> | undefined;
  mergedWhere.create = { ...create, userId: tenantId };
  if (update && typeof update === "object") {
    const { userId: _u, ...rest } = update;
    mergedWhere.update = { ...rest, userId: tenantId };
  } else {
    mergedWhere.update = { userId: tenantId };
  }
  return mergedWhere;
}

function applyUserIdTenant(
  operation: string,
  args: Record<string, unknown>,
  tenantId: string,
  modelKey?: (typeof USER_ID_MODELS)[number],
): Record<string, unknown> {
  if (modelKey === "subscription" && operation === "findUnique") {
    return mergeSubscriptionFindUnique(args, tenantId);
  }
  switch (operation) {
    case "findUnique":
    case "findFirst":
    case "findMany":
    case "count":
    case "aggregate":
    case "groupBy":
      return mergeWhereUserId(args, tenantId);
    case "create":
      return injectCreateUserId(args, tenantId);
    case "createMany":
      return injectCreateManyUserId(args, tenantId);
    case "update":
    case "updateMany":
      return mergeUpdateUserId(args, tenantId);
    case "upsert":
      return mergeUpsertUserId(args, tenantId);
    case "delete":
    case "deleteMany":
      return mergeWhereUserId(args, tenantId);
    default:
      return args;
  }
}

function userWhereHasEmailOrGoogleWithoutId(where: unknown): boolean {
  if (!where || typeof where !== "object") return false;
  const w = where as Record<string, unknown>;
  if (w.AND || w.OR || w.NOT) return false;
  const hasId = w.id !== undefined;
  if (hasId) return false;
  return w.email !== undefined || w.googleId !== undefined;
}

function extractIdFromWhere(where: unknown): string | undefined {
  if (!where || typeof where !== "object") return undefined;
  const w = where as Record<string, unknown>;
  if (typeof w.id === "string") return w.id;
  return undefined;
}

function applyUserTenant(operation: string, args: Record<string, unknown>, tenantId: string): Record<string, unknown> {
  switch (operation) {
    case "create":
    case "createMany":
    case "upsert":
      throw new TenantIsolationError("User.create / upsert deve usar systemPrisma (registo/login).");
    case "findUnique": {
      const where = args.where;
      if (userWhereHasEmailOrGoogleWithoutId(where)) {
        throw new TenantIsolationError("User.findUnique por e-mail/googleId deve usar systemPrisma.");
      }
      const directId = extractIdFromWhere(where);
      if (directId !== undefined && directId !== tenantId) {
        logCrossTenantBlocked({ model: "User", tenantId, attemptedResource: directId });
        throw new TenantIsolationError("Acesso negado: recurso de outro tenant.");
      }
      return mergeWhereUserIdEqualsId(args, tenantId);
    }
    case "findFirst":
    case "findMany":
    case "count":
    case "aggregate":
    case "groupBy":
      return mergeWhereUserIdEqualsId(args, tenantId);
    case "update":
    case "updateMany": {
      const merged = mergeWhereUserIdEqualsId(args, tenantId);
      const data = args.data as Record<string, unknown> | undefined;
      if (data && typeof data === "object") {
        const { id: _i, ...rest } = data;
        merged.data = rest;
      }
      return merged;
    }
    case "delete":
    case "deleteMany":
      return mergeWhereUserIdEqualsId(args, tenantId);
    default:
      return args;
  }
}

/** Bloqueia SQL raw no cliente tenant (evita bypass do filtro). */
export const blockRawQueriesExtension = {
  client: {
    $queryRaw: () => {
      logTenantViolation("raw_query_blocked", { op: "$queryRaw" });
      throw new TenantIsolationError("SQL raw não permitido no cliente tenant.");
    },
    $queryRawUnsafe: () => {
      logTenantViolation("raw_query_blocked", { op: "$queryRawUnsafe" });
      throw new TenantIsolationError("SQL raw não permitido no cliente tenant.");
    },
    $executeRaw: () => {
      logTenantViolation("raw_query_blocked", { op: "$executeRaw" });
      throw new TenantIsolationError("SQL raw não permitido no cliente tenant.");
    },
    $executeRawUnsafe: () => {
      logTenantViolation("raw_query_blocked", { op: "$executeRawUnsafe" });
      throw new TenantIsolationError("SQL raw não permitido no cliente tenant.");
    },
  },
};

function buildUserIdModelExtension(modelKey: (typeof USER_ID_MODELS)[number]) {
  return {
    async $allOperations({
      operation,
      args,
      query,
    }: {
      operation: string;
      args: unknown;
      query: (a: unknown) => Promise<unknown>;
    }) {
      const tenantId = requireTenantId();
      const next = applyUserIdTenant(operation, (args ?? {}) as Record<string, unknown>, tenantId, modelKey);
      return query(next);
    },
  };
}

function buildUserModelExtension() {
  return {
    async $allOperations({
      operation,
      args,
      query,
    }: {
      operation: string;
      args: unknown;
      query: (a: unknown) => Promise<unknown>;
    }) {
      const tenantId = requireTenantId();
      const next = applyUserTenant(operation, (args ?? {}) as Record<string, unknown>, tenantId);
      return query(next);
    },
  };
}

/** Plan: catálogo global — leituras permitidas; escrita só via prismaAdmin. */
function buildPlanExtension() {
  return {
    async $allOperations({
      operation,
      args,
      query,
    }: {
      operation: string;
      args: unknown;
      query: (a: unknown) => Promise<unknown>;
    }) {
      requireTenantId();
      if (MUTATING_PLAN_OPS.has(operation)) {
        logTenantViolation("plan_mutation_on_tenant_client", { operation });
        throw new TenantIsolationError("Alterações a Plan devem usar prismaAdmin.");
      }
      return query(args);
    },
  };
}

/** SiteBranding: sem tenant por linha — não usar no cliente tenant. */
function buildSiteBrandingExtension() {
  return {
    async $allOperations() {
      requireTenantId();
      logTenantViolation("site_branding_on_tenant_client");
      throw new TenantIsolationError("SiteBranding deve usar systemPrisma (público) ou prismaAdmin.");
    },
  };
}

/**
 * Cliente tenant: exige AsyncLocalStorage com tenantId; injeta filtros; fail-fast.
 * Não há bypass: admins usam prismaAdmin.
 */
export function applyTenantSafeExtension(base: PrismaClient): PrismaClient {
  const query: Record<string, unknown> = {
    user: buildUserModelExtension(),
    plan: buildPlanExtension(),
    siteBranding: buildSiteBrandingExtension(),
  };

  for (const m of USER_ID_MODELS) {
    query[m] = buildUserIdModelExtension(m);
  }

  const extension = { query };

  return base.$extends(extension as never).$extends(blockRawQueriesExtension as never) as unknown as PrismaClient;
}
