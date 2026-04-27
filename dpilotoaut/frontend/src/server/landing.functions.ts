import { createServerFn } from "@tanstack/react-start";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireSession } from "@/integrations/auth/auth-middleware";
import { applyHotmartEnvToLandingDocument } from "@/lib/landing-hotmart-env";
import {
  getDefaultLandingDocument,
  landingDocumentSchema,
  type LandingDocument,
} from "@/lib/landing-document";
import { prisma } from "@backend/prisma";
import {
  assertCanReadOrgLanding,
  assertCanWriteOrgLanding,
  getUserLandingRole,
} from "@backend/landing-access";
import { isUserPlatformAdminById } from "@backend/platform-admin";
import { listWorkspacesForUser } from "@backend/tenancy";

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseDoc(json: unknown): LandingDocument {
  const p = landingDocumentSchema.safeParse(json);
  if (p.success) return p.data;
  return getDefaultLandingDocument();
}

const idInput = z.object({ id: z.string().uuid() });
const slugInput = z.object({ slug: z.string().min(1).max(100) });
const listInput = z
  .object({ organizationId: z.string().uuid().optional() })
  .optional();

const createInput = z.object({
  name: z.string().min(1).max(200),
  organizationId: z.string().uuid(),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(
      slugRe,
      "Endereço: só letras minúsculas, números e hífen (ex.: a-minha-pagina).",
    ),
});

const saveInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(slugRe)
    .optional(),
  isPublished: z.boolean().optional(),
  document: z.unknown().optional(),
  theme: z.any().optional().nullable(),
});

/** Contas (organizações) em que o utilizador pode escolher ao criar uma landing. */
export const listOrganizationsForLanding = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }) => {
    if (await isUserPlatformAdminById(context.userId)) {
      return prisma.organization.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
      });
    }
    const ws = await listWorkspacesForUser(context.userId);
    return ws.map((w) => ({
      id: w.organizationId,
      name: w.name,
      slug: w.slug,
    }));
  });

export const listLandingPages = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => listInput.parse(input ?? undefined))
  .handler(async ({ data, context }) => {
    const platform = await isUserPlatformAdminById(context.userId);
    const filterOrgId = data?.organizationId;
    if (platform) {
      if (filterOrgId) {
        return prisma.landingPage.findMany({
          where: { organizationId: filterOrgId },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            name: true,
            slug: true,
            isPublished: true,
            updatedAt: true,
            organizationId: true,
            organization: { select: { name: true, slug: true } },
          },
        });
      }
      return prisma.landingPage.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          isPublished: true,
          updatedAt: true,
          organizationId: true,
          organization: { select: { name: true, slug: true } },
        },
      });
    }
    const ws = await listWorkspacesForUser(context.userId);
    const orgIds = ws.map((w) => w.organizationId);
    if (orgIds.length === 0) {
      return [];
    }
    if (filterOrgId) {
      if (!orgIds.includes(filterOrgId)) {
        throw new Response("Forbidden", { status: 403 });
      }
      return prisma.landingPage.findMany({
        where: { organizationId: filterOrgId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          isPublished: true,
          updatedAt: true,
          organizationId: true,
          organization: { select: { name: true, slug: true } },
        },
      });
    }
    return prisma.landingPage.findMany({
      where: { organizationId: { in: orgIds } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        isPublished: true,
        updatedAt: true,
        organizationId: true,
        organization: { select: { name: true, slug: true } },
      },
    });
  });

export const getLandingPageAdmin = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data, context }) => {
    const row = await prisma.landingPage.findUnique({
      where: { id: data.id },
      include: { organization: { select: { name: true, slug: true } } },
    });
    if (!row) return null;
    await assertCanReadOrgLanding(context.userId, row.organizationId);
    const access = await getUserLandingRole(context.userId, row.organizationId);
    if (access === "none") return null;
    const themePlain: Record<string, string> = {};
    if (row.theme && typeof row.theme === "object" && !Array.isArray(row.theme)) {
      for (const [k, v] of Object.entries(row.theme as Record<string, unknown>)) {
        if (typeof v === "string") themePlain[k] = v;
        else if (v != null) themePlain[k] = String(v);
      }
    }
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      isPublished: row.isPublished,
      organizationId: row.organizationId,
      organizationName: row.organization.name,
      access,
      document: JSON.parse(
        JSON.stringify(applyHotmartEnvToLandingDocument(parseDoc(row.document))),
      ),
      theme: themePlain,
    };
  });

export const createLandingPage = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCanWriteOrgLanding(context.userId, data.organizationId);
    const taken = await prisma.landingPage.findFirst({ where: { slug: data.slug } });
    if (taken) throw new Error("Já existe outra página com este endereço. Escolha outro.");
    const doc = applyHotmartEnvToLandingDocument(getDefaultLandingDocument());
    const row = await prisma.landingPage.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        slug: data.slug,
        document: doc as object,
        theme: { primary: "hsl(142 70% 45%)", contentWidth: "max-w-5xl" },
        updatedById: context.userId,
      },
    });
    return { id: row.id, slug: row.slug };
  });

export const saveLandingPage = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => saveInput.parse(input))
  .handler(async ({ data, context }) => {
    const existing = await prisma.landingPage.findUnique({ where: { id: data.id } });
    if (!existing) throw new Error("Página inexistente.");
    await assertCanWriteOrgLanding(context.userId, existing.organizationId);

    const doc = data.document != null ? parseDoc(data.document) : parseDoc(existing.document);
    if (data.slug && data.slug !== existing.slug) {
      const taken = await prisma.landingPage.findFirst({ where: { slug: data.slug, NOT: { id: data.id } } });
      if (taken) throw new Error("Já existe outra página com este endereço.");
    }

    const row = await prisma.landingPage.update({
      where: { id: data.id },
      data: {
        ...(data.name != null ? { name: data.name } : {}),
        ...(data.slug != null ? { slug: data.slug } : {}),
        ...(data.isPublished != null ? { isPublished: data.isPublished } : {}),
        document: doc as object,
        ...(data.theme !== undefined
          ? {
              theme: data.theme === null ? Prisma.JsonNull : (data.theme as Prisma.InputJsonValue),
            }
          : {}),
        updatedById: context.userId,
      },
    });
    return { id: row.id, slug: row.slug };
  });

export const deleteLandingPage = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data, context }) => {
    const row = await prisma.landingPage.findUnique({ where: { id: data.id } });
    if (!row) return { ok: true as const };
    await assertCanWriteOrgLanding(context.userId, row.organizationId);
    await prisma.landingPage.delete({ where: { id: data.id } });
    return { ok: true as const };
  });

/** Pública: só se publicada. */
export const getPublishedLanding = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => slugInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const row = await prisma.landingPage.findFirst({
        where: { slug: data.slug, isPublished: true },
      });
      if (!row) return null;
      const themePlain: Record<string, string> | null =
        row.theme && typeof row.theme === "object" && !Array.isArray(row.theme)
          ? (() => {
              const o: Record<string, string> = {};
              for (const [k, v] of Object.entries(row.theme as Record<string, unknown>)) {
                if (typeof v === "string") o[k] = v;
                else if (v != null) o[k] = String(v);
              }
              return o;
            })()
          : null;
      return {
        name: row.name,
        document: JSON.parse(
          JSON.stringify(applyHotmartEnvToLandingDocument(parseDoc(row.document))),
        ),
        theme: themePlain,
      };
    } catch (e) {
      console.error("[getPublishedLanding]", e);
      throw e;
    }
  });
