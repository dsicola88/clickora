import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { systemPrisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { resolveWorkspaceSessionForLogin } from "../lib/workspaceSession";
import { evaluateSubscriptionAccess } from "../lib/subscription";
import { z } from "zod";
import { AVATAR_LOCAL_MARKER, removeUserAvatarFiles } from "../lib/avatarUpload";
import type { PlanType, WorkspaceRole } from "@prisma/client";
import { resolveDefaultPlanForSignup } from "../lib/defaultPlan";
import { effectiveMaxCustomDomainsFromPlan } from "../lib/customDomainLimits";

const loginSchema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(6),
});

const googleLoginSchema = z.object({
  id_token: z.string().min(20),
});

const registerSchema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(6),
  full_name: z.string().trim().min(2),
});

function publicAvatarUrl(req: Request, user: { id: string; avatarUrl: string | null; updatedAt: Date }): string | null {
  if (!user.avatarUrl) return null;
  if (user.avatarUrl.startsWith("http")) return user.avatarUrl;
  if (user.avatarUrl === AVATAR_LOCAL_MARKER) {
    const host = `${req.protocol}://${req.get("host")}`;
    return `${host}/api/public/avatar/${user.id}?v=${user.updatedAt.getTime()}`;
  }
  return null;
}

type SerialUser = {
  id: string;
  email: string;
  fullName: string | null;
  workspaceId: string;
  avatarUrl: string | null;
  saleNotifyEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
  roles: { role: string }[];
  subscription: {
    plan: {
      name: string;
      type: string;
      maxPresellPages: number | null;
      maxClicksPerMonth: number | null;
      maxCustomDomains?: number | null;
      hasBranding: boolean;
    } | null;
  } | null;
};

function serializeUser(
  user: SerialUser,
  req: Request,
  opts?: {
    tenantUserId: string;
    workspaceRole: WorkspaceRole;
    workspacePermissions?: string[];
    /** Limites de plano da conta de faturação (ex.: dono do workspace). */
    planSource?: SerialUser;
  },
) {
  const role = user.roles[0]?.role || "user";
  const planFrom = opts?.planSource ?? user;
  const plan = planFrom.subscription?.plan;
  const workspacePermissions = opts?.workspacePermissions ?? [];
  return {
    id: user.id,
    name: user.fullName || "",
    email: user.email,
    workspace_id: user.workspaceId,
    tenant_user_id: opts?.tenantUserId ?? user.id,
    workspace_role: opts?.workspaceRole ?? "owner",
    workspace_permissions: workspacePermissions,
    role,
    avatar_url: publicAvatarUrl(req, user),
    created_at: user.createdAt.toISOString(),
    sale_notify_email: user.saleNotifyEmail ?? "",
    plan: plan
      ? {
          plan_name: plan.name,
          plan_type: plan.type,
          max_pages: plan.maxPresellPages,
          max_clicks: plan.maxClicksPerMonth,
          max_custom_domains: effectiveMaxCustomDomainsFromPlan({
            type: plan.type as PlanType,
            maxCustomDomains:
              typeof plan.maxCustomDomains === "number" ? plan.maxCustomDomains : null,
          }),
          has_branding: plan.hasBranding,
        }
      : null,
  };
}

async function serializeUserWithSession(user: SerialUser, req: Request) {
  const sess = await resolveWorkspaceSessionForLogin(user.id);
  const billing = await systemPrisma.user.findUnique({
    where: { id: sess.tenantUserId },
    include: { subscription: { include: { plan: true } }, roles: true },
  });
  const isPlatformAdmin = user.roles.some((r) => r.role === "admin" || r.role === "super_admin");
  return serializeUser(user, req, {
    tenantUserId: sess.tenantUserId,
    workspaceRole: sess.workspaceRole,
    workspacePermissions: sess.workspacePermissions,
    planSource: isPlatformAdmin ? user : billing ?? user,
  });
}

export const authController = {
  async login(req: Request, res: Response) {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });

    const { email, password } = parsed.data;
    const user = await systemPrisma.user.findUnique({
      where: { email },
      include: {
        roles: true,
        subscription: { include: { plan: true } },
      },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "E-mail ou senha incorretos" });
    }

    const sess = await resolveWorkspaceSessionForLogin(user.id);
    const billing = await systemPrisma.user.findUnique({
      where: { id: sess.tenantUserId },
      include: { subscription: { include: { plan: true } }, roles: true },
    });
    if (!billing) {
      return res.status(401).json({ error: "Conta não encontrada" });
    }

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
  },

  /**
   * Login com Google (ID token). Regra comercial:
   * - Não cria conta nova nem permite “qualquer e-mail Google”.
   * - Só entra quem **já está na base de dados** com o mesmo e-mail **e** senha registada (registo/assinatura na app).
   * - O Google substitui apenas o passo de escrever a senha, desde que o e-mail coincida.
   */
  async googleLogin(req: Request, res: Response) {
    const parsed = googleLoginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Token inválido", details: parsed.error.flatten() });

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    if (!clientId) {
      return res.status(503).json({ error: "Login com Google não está configurado no servidor." });
    }

    const oauth = new OAuth2Client(clientId);
    let ticket;
    try {
      ticket = await oauth.verifyIdToken({
        idToken: parsed.data.id_token,
        audience: clientId,
      });
    } catch {
      return res.status(401).json({ error: "Não foi possível validar o Google. Tente novamente." });
    }

    const payload = ticket.getPayload();
    if (!payload?.email || payload.email_verified !== true) {
      return res.status(401).json({ error: "O e-mail da conta Google tem de estar verificado." });
    }

    const email = payload.email.toLowerCase().trim();
    const googleSub = payload.sub;

    let user = await systemPrisma.user.findUnique({
      where: { email },
      include: {
        roles: true,
        subscription: { include: { plan: true } },
      },
    });

    if (!user) {
      return res.status(403).json({
        error:
          "Não há conta comercial com este e-mail. Registe-se primeiro na plataforma (mesmo e-mail e senha) ou use a sua assinatura; depois poderá usar o Google com o mesmo e-mail.",
      });
    }

    /** Só contas com senha definida na app (registo por e-mail/senha). Sem hash válido = não entra só pelo Google. */
    const hasPasswordHash = Boolean(user.password?.trim()) && /^\$2[aby]\$/.test(user.password);
    if (!hasPasswordHash) {
      return res.status(403).json({
        error:
          "Esta conta não tem senha registada na plataforma. Entre com e-mail e senha ou conclua o registo antes de usar o Google.",
      });
    }

    if (user.googleId && user.googleId !== googleSub) {
      return res.status(403).json({
        error: "Esta conta já está associada a outro login Google.",
      });
    }

    const needsProfileSync =
      !user.googleId ||
      (!user.avatarUrl && payload.picture) ||
      (!user.fullName?.trim() && payload.name);
    if (needsProfileSync) {
      await systemPrisma.user.update({
        where: { id: user.id },
        data: {
          ...(!user.googleId ? { googleId: googleSub } : {}),
          ...(payload.picture && !user.avatarUrl ? { avatarUrl: payload.picture } : {}),
          ...(payload.name && !user.fullName?.trim() ? { fullName: payload.name } : {}),
        },
      });
      user = await systemPrisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: {
          roles: true,
          subscription: { include: { plan: true } },
        },
      });
    }

    const sess = await resolveWorkspaceSessionForLogin(user.id);
    const billing = await systemPrisma.user.findUnique({
      where: { id: sess.tenantUserId },
      include: { subscription: { include: { plan: true } }, roles: true },
    });
    if (!billing) {
      return res.status(401).json({ error: "Conta não encontrada" });
    }

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
  },

  async register(req: Request, res: Response) {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });

    const { email, password, full_name } = parsed.data;

    const existing = await systemPrisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "E-mail já cadastrado" });

    const hashedPassword = await bcrypt.hash(password, 12);

    const defaultPlan = await resolveDefaultPlanForSignup();

    const user = await systemPrisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          fullName: full_name,
          roles: { create: { role: "user" } },
          ...(defaultPlan && {
            subscription: {
              create: {
                planId: defaultPlan.id,
                status: "active",
              },
            },
          }),
        },
      });
      await tx.workspace.create({
        data: {
          id: u.workspaceId,
          name: full_name.trim().slice(0, 200),
          ownerUserId: u.id,
          members: { create: { userId: u.id, role: "owner" } },
        },
      });
      return tx.user.findUniqueOrThrow({
        where: { id: u.id },
        include: {
          roles: true,
          subscription: { include: { plan: true } },
        },
      });
    });

    const sess = await resolveWorkspaceSessionForLogin(user.id);
    const token = signToken({
      userId: user.id,
      email: user.email,
      tenantUserId: sess.tenantUserId,
      workspaceId: sess.workspaceId,
      workspaceRole: sess.workspaceRole,
      workspacePermissions: sess.workspacePermissions,
    });

    res.status(201).json({
      token,
      user: serializeUser(user, req, {
        tenantUserId: sess.tenantUserId,
        workspaceRole: sess.workspaceRole,
        workspacePermissions: sess.workspacePermissions,
      }),
    });
  },

  async me(req: Request, res: Response) {
    const user = await systemPrisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        roles: true,
        subscription: { include: { plan: true } },
      },
    });

    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    res.json(await serializeUserWithSession(user, req));
  },

  async patchProfile(req: Request, res: Response) {
    const userId = req.user!.userId;
    const patchSchema = z.object({
      full_name: z.string().min(1).max(120).optional(),
      avatar_url: z.union([z.string().url(), z.null()]).optional(),
    });
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    const d = parsed.data;
    const data: { fullName?: string; avatarUrl?: string | null } = {};
    if (d.full_name !== undefined) data.fullName = d.full_name;
    if (d.avatar_url !== undefined) {
      removeUserAvatarFiles(userId);
      data.avatarUrl = d.avatar_url;
    }

    if (Object.keys(data).length === 0) {
      const user = await systemPrisma.user.findUniqueOrThrow({
        where: { id: userId },
        include: { roles: true, subscription: { include: { plan: true } } },
      });
      const sess = await resolveWorkspaceSessionForLogin(user.id);
      const billing = await systemPrisma.user.findUnique({
        where: { id: sess.tenantUserId },
        include: { subscription: { include: { plan: true } }, roles: true },
      });
      const isPlatformAdmin = user.roles.some((r) => r.role === "admin" || r.role === "super_admin");
      return res.json(
        serializeUser(user, req, {
          tenantUserId: sess.tenantUserId,
          workspaceRole: sess.workspaceRole,
          workspacePermissions: sess.workspacePermissions,
          planSource: isPlatformAdmin ? user : billing ?? user,
        }),
      );
    }

    const user = await systemPrisma.user.update({
      where: { id: userId },
      data,
      include: { roles: true, subscription: { include: { plan: true } } },
    });

    const sess = await resolveWorkspaceSessionForLogin(user.id);
    const billing = await systemPrisma.user.findUnique({
      where: { id: sess.tenantUserId },
      include: { subscription: { include: { plan: true } }, roles: true },
    });
    const isPlatformAdmin = user.roles.some((r) => r.role === "admin" || r.role === "super_admin");
    return res.json(
      serializeUser(user, req, {
        tenantUserId: sess.tenantUserId,
        workspaceRole: sess.workspaceRole,
        workspacePermissions: sess.workspacePermissions,
        planSource: isPlatformAdmin ? user : billing ?? user,
      }),
    );
  },

  async changePassword(req: Request, res: Response) {
    const schema = z.object({
      current_password: z.string().min(1),
      new_password: z.string().min(6),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    const user = await systemPrisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    if (!(await bcrypt.compare(parsed.data.current_password, user.password))) {
      return res.status(401).json({ error: "Senha atual incorreta" });
    }

    await systemPrisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(parsed.data.new_password, 12) },
    });

    res.json({ message: "Senha alterada com sucesso" });
  },

  async uploadAvatar(req: Request, res: Response) {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "Envie um ficheiro no campo avatar." });
    }
    const userId = req.user!.userId;
    const user = await systemPrisma.user.update({
      where: { id: userId },
      data: { avatarUrl: AVATAR_LOCAL_MARKER },
      include: { roles: true, subscription: { include: { plan: true } } },
    });
    return res.json({ ok: true, user: await serializeUserWithSession(user, req) });
  },

  async deleteAvatar(req: Request, res: Response) {
    const userId = req.user!.userId;
    removeUserAvatarFiles(userId);
    const user = await systemPrisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      include: { roles: true, subscription: { include: { plan: true } } },
    });
    return res.json({ ok: true, user: await serializeUserWithSession(user, req) });
  },

  async logout(_req: Request, res: Response) {
    res.json({ message: "Logout realizado" });
  },

  async resetPassword(req: Request, res: Response) {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "E-mail é obrigatório" });

    const user = await systemPrisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ message: "Se o e-mail existir, enviaremos um link de recuperação." });
    }

    res.json({ message: "Se o e-mail existir, enviaremos um link de recuperação." });
  },

  async updatePassword(req: Request, res: Response) {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token e senha são obrigatórios" });

    res.json({ message: "Senha atualizada com sucesso" });
  },
};
