import { Request, Response } from "express";
import { z } from "zod";
import { systemPrisma } from "../lib/prisma";
import { serializeUser } from "./auth.controller";
import { resolveWorkspaceSessionForLogin } from "../lib/workspaceSession";
import { evaluateSubscriptionAccess } from "../lib/subscription";
import { signToken } from "../lib/jwt";
import {
  consumeBackupCode,
  decryptMfaSecret,
  encryptMfaSecret,
  generateBackupCodes,
  generateMfaSecret,
  mfaOtpauthUrl,
  verifyMfaPendingToken,
  verifyTotp,
} from "../lib/mfa";
import bcrypt from "bcryptjs";

async function issueSession(userId: string, req: Request, res: Response) {
  const user = await systemPrisma.user.findUnique({
    where: { id: userId },
    include: { roles: true, subscription: { include: { plan: true } } },
  });
  if (!user) return res.status(401).json({ error: "Conta não encontrada" });

  const sess = await resolveWorkspaceSessionForLogin(user.id);
  const billing = await systemPrisma.user.findUnique({
    where: { id: sess.tenantUserId },
    include: { subscription: { include: { plan: true } }, roles: true },
  });
  if (!billing) return res.status(401).json({ error: "Conta não encontrada" });

  const isPlatformAdmin = user.roles.some((r) => r.role === "admin" || r.role === "super_admin");
  let subRow = isPlatformAdmin ? user.subscription : billing.subscription;
  let access = evaluateSubscriptionAccess(subRow);
  if (access.shouldMarkExpired && subRow && subRow.status !== "expired") {
    await systemPrisma.subscription.update({
      where: { id: subRow.id },
      data: { status: "expired" },
    });
    subRow = await systemPrisma.subscription.findUnique({
      where: { id: subRow.id },
      include: { plan: true },
    });
  }
  access = evaluateSubscriptionAccess(subRow);
  if (!access.allowed) {
    return res.status(403).json({
      error: "Assinatura inválida ou expirada. Atualize seu plano para continuar.",
    });
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    tenantUserId: sess.tenantUserId,
    workspaceId: sess.workspaceId,
    workspaceRole: sess.workspaceRole,
    workspacePermissions: sess.workspacePermissions,
    purpose: "session",
  });

  res.json({
    token,
    user: serializeUser(user, req, {
      tenantUserId: sess.tenantUserId,
      workspaceRole: sess.workspaceRole,
      workspacePermissions: sess.workspacePermissions,
      planSource: isPlatformAdmin ? user : billing,
    }),
  });
}

export const mfaController = {
  async setupStart(req: Request, res: Response) {
    const userId = req.user!.userId;
    const user = await systemPrisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });
    if (user.mfaEnabled) {
      return res.status(400).json({ error: "MFA já está activo. Desactive primeiro para reconfigurar." });
    }
    const secret = generateMfaSecret();
    await systemPrisma.user.update({
      where: { id: userId },
      data: { mfaSecretEnc: encryptMfaSecret(secret), mfaEnabled: false },
    });
    res.json({
      secret,
      otpauth_url: mfaOtpauthUrl({ email: user.email, secret }),
    });
  },

  async setupConfirm(req: Request, res: Response) {
    const parsed = z.object({ code: z.string().min(6).max(12) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Código inválido" });
    const userId = req.user!.userId;
    const user = await systemPrisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecretEnc) {
      return res.status(400).json({ error: "Inicie o setup MFA primeiro." });
    }
    const secret = decryptMfaSecret(user.mfaSecretEnc);
    if (!secret || !verifyTotp(secret, parsed.data.code)) {
      return res.status(400).json({ error: "Código incorrecto." });
    }
    const backups = await generateBackupCodes();
    await systemPrisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaBackupCodes: backups.hashedJson },
    });
    res.json({
      mfa_enabled: true,
      backup_codes: backups.plain,
      warning: "Guarde os códigos de recuperação. Só são mostrados uma vez.",
    });
  },

  async disable(req: Request, res: Response) {
    const parsed = z
      .object({ code: z.string().min(6).max(32), password: z.string().min(1) })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });
    const userId = req.user!.userId;
    const user = await systemPrisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled) return res.status(400).json({ error: "MFA não está activo." });
    if (!(await bcrypt.compare(parsed.data.password, user.password))) {
      return res.status(401).json({ error: "Senha incorrecta." });
    }
    const secret = decryptMfaSecret(user.mfaSecretEnc);
    let ok = secret ? verifyTotp(secret, parsed.data.code) : false;
    if (!ok) {
      const consumed = await consumeBackupCode(user.mfaBackupCodes, parsed.data.code);
      ok = consumed.ok;
    }
    if (!ok) return res.status(400).json({ error: "Código MFA incorrecto." });
    await systemPrisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecretEnc: null, mfaBackupCodes: null },
    });
    res.json({ mfa_enabled: false });
  },

  async status(req: Request, res: Response) {
    const user = await systemPrisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { mfaEnabled: true },
    });
    res.json({ mfa_enabled: Boolean(user?.mfaEnabled) });
  },

  async verifyLogin(req: Request, res: Response) {
    const parsed = z
      .object({ mfa_token: z.string().min(10), code: z.string().min(6).max(32) })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });
    let pending;
    try {
      pending = verifyMfaPendingToken(parsed.data.mfa_token);
    } catch {
      return res.status(401).json({ error: "Sessão MFA expirada. Faça login novamente." });
    }
    const user = await systemPrisma.user.findUnique({ where: { id: pending.userId } });
    if (!user?.mfaEnabled) return res.status(400).json({ error: "MFA não activo." });
    const secret = decryptMfaSecret(user.mfaSecretEnc);
    let ok = secret ? verifyTotp(secret, parsed.data.code) : false;
    if (!ok) {
      const consumed = await consumeBackupCode(user.mfaBackupCodes, parsed.data.code);
      if (consumed.ok) {
        ok = true;
        await systemPrisma.user.update({
          where: { id: user.id },
          data: { mfaBackupCodes: consumed.nextJson },
        });
      }
    }
    if (!ok) return res.status(401).json({ error: "Código MFA incorrecto." });
    return issueSession(user.id, req, res);
  },
};
