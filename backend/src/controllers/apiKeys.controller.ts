import { Request, Response } from "express";
import { z } from "zod";
import { systemPrisma } from "../lib/prisma";
import { billingUserId } from "../lib/requestContext";
import { generateApiKeyPlain, hashApiKey } from "../lib/apiKeys";

export const apiKeysController = {
  async list(req: Request, res: Response) {
    const userId = billingUserId(req);
    const rows = await systemPrisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        key_prefix: r.keyPrefix,
        scopes: r.scopes,
        last_used_at: r.lastUsedAt,
        created_at: r.createdAt,
      })),
    );
  },

  async create(req: Request, res: Response) {
    const parsed = z
      .object({
        name: z.string().trim().min(1).max(80),
        scopes: z.array(z.enum(["read", "write"])).min(1).max(4).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const userId = billingUserId(req);
    const { plain, prefix } = generateApiKeyPlain();
    const keyHash = await hashApiKey(plain);
    const row = await systemPrisma.apiKey.create({
      data: {
        userId,
        name: parsed.data.name,
        keyPrefix: prefix,
        keyHash,
        scopes: parsed.data.scopes ?? ["read", "write"],
      },
    });
    res.status(201).json({
      id: row.id,
      name: row.name,
      key_prefix: row.keyPrefix,
      /** Só nesta resposta — não volta a ser mostrado. */
      api_key: plain,
      scopes: row.scopes,
      created_at: row.createdAt,
      warning: "Guarde a API key agora. Não será possível voltar a vê-la.",
    });
  },

  async revoke(req: Request, res: Response) {
    const userId = billingUserId(req);
    const id = req.params.id?.trim();
    if (!id) return res.status(400).json({ error: "ID em falta" });
    const row = await systemPrisma.apiKey.findFirst({ where: { id, userId, revokedAt: null } });
    if (!row) return res.status(404).json({ error: "API key não encontrada" });
    await systemPrisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    res.status(204).end();
  },
};
