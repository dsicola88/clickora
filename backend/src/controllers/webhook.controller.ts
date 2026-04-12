import type { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { systemPrisma } from "../lib/prisma";
import { normalizeSubscriptionStatus, periodEndByPlan } from "../lib/subscription";
import { sendTransactionalEmail } from "../lib/mailer";
import type { PlanType, User, UserRole } from "@prisma/client";

type HotmartEventData = {
  event: string;
  email: string;
  productCode: string | null;
  offerCode: string | null;
  buyerName: string | null;
  approvedDate: Date | null;
  endDate: Date | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

/** Token enviado pela Hotmart (headers oficiais ou `Authorization: Bearer …`). */
function extractHotmartWebhookToken(req: Request): string | null {
  const headerNames = ["x-hotmart-hottok", "x-hotmart-token"] as const;
  for (const name of headerNames) {
    const v = req.headers[name];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
  }
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.trim()) {
    const t = auth.trim();
    const m = /^Bearer\s+(.+)$/i.exec(t);
    return (m ? m[1] : t).trim();
  }
  return null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseHotmartPayload(body: unknown): HotmartEventData | null {
  const root = asRecord(body);
  const data = asRecord(root.data);
  const buyer = asRecord(data.buyer);
  const purchase = asRecord(data.purchase);
  const subscription = asRecord(data.subscription);
  const product = asRecord(data.product);
  const offer = asRecord(data.offer);

  const event = pickString(root.event, data.event, purchase.status, subscription.status);
  const email = pickString(
    buyer.email,
    purchase.buyer_email,
    data.email,
    root.email
  );

  if (!event || !email) return null;

  return {
    event,
    email: email.toLowerCase(),
    productCode: pickString(product.id, product.ucode, purchase.product_id, data.product_id),
    offerCode: pickString(offer.code, purchase.offer_code, data.offer_code),
    buyerName: pickString(buyer.name, data.name),
    approvedDate: parseDate(purchase.approved_date ?? data.approved_date ?? root.created_at),
    endDate: parseDate(subscription.end_date ?? purchase.subscription_end_date ?? data.end_date),
  };
}

function resolvePlanType(productCode: string | null, offerCode: string | null): PlanType {
  const mapRaw = process.env.HOTMART_PLAN_MAP || "{}";
  const fallback = (process.env.HOTMART_DEFAULT_PLAN_TYPE as PlanType | undefined) || "monthly";

  try {
    const map = JSON.parse(mapRaw) as Record<string, PlanType>;
    const code = offerCode || productCode;
    if (code && map[code]) return map[code];
  } catch {
    // ignore invalid JSON and use fallback
  }

  return fallback;
}

type UserWithRoles = User & { roles: UserRole[] };

/**
 * Compra Hotmart → conta na app: 1 utilizador = 1 tenant (workspaceId único).
 * Utilizador novo recebe senha provisória por e-mail (se SMTP configurado).
 */
async function findOrCreateUser(
  email: string,
  buyerName: string | null,
): Promise<{ user: UserWithRoles; created: boolean; provisionalPassword: string | null }> {
  const existing = await systemPrisma.user.findUnique({
    where: { email },
    include: { roles: true },
  });
  if (existing) {
    return { user: existing, created: false, provisionalPassword: null };
  }

  const provisionalPassword = crypto.randomBytes(18).toString("base64url");
  const passwordHash = await bcrypt.hash(provisionalPassword, 12);

  const user = await systemPrisma.user.create({
    data: {
      email,
      password: passwordHash,
      fullName: buyerName || email.split("@")[0] || "Cliente",
      roles: { create: { role: "user" } },
    },
    include: { roles: true },
  });

  return { user, created: true, provisionalPassword };
}

function loginPageUrl(): string {
  const raw = process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || "http://localhost:8080";
  const base = raw.split(",")[0].trim().replace(/\/$/, "");
  return `${base}/login`;
}

async function sendHotmartWelcomeEmail(to: string, provisionalPassword: string): Promise<{ sent: boolean; reason?: string }> {
  const loginUrl = loginPageUrl();
  const subject = "A sua conta Clickora está pronta";
  const text =
    `Olá,\n\n` +
    `A sua compra foi confirmada na Hotmart e criámos a sua conta na plataforma.\n\n` +
    `Entrar: ${loginUrl}\n` +
    `E-mail: ${to}\n` +
    `Senha provisória: ${provisionalPassword}\n\n` +
    `Recomendamos alterar a senha após o primeiro login (definições da conta).\n\n` +
    `Se não reconhece esta compra, contacte o suporte.\n`;

  const result = await sendTransactionalEmail({ to, subject, text });
  if (!result.sent) {
    console.warn("[hotmart-webhook] welcome email not sent:", result.reason);
    return { sent: false, reason: result.reason };
  }
  return { sent: true };
}

export const webhookController = {
  async hotmart(req: Request, res: Response) {
    const expectedToken = process.env.HOTMART_WEBHOOK_TOKEN;
    if (expectedToken) {
      const incoming = extractHotmartWebhookToken(req);
      if (!incoming || incoming !== expectedToken.trim()) {
        return res.status(401).json({ error: "Webhook token inválido" });
      }
    }

    const payload = parseHotmartPayload(req.body);
    if (!payload) {
      return res.status(400).json({ error: "Payload de webhook inválido" });
    }

    const status = normalizeSubscriptionStatus(payload.event);
    const { user, created, provisionalPassword } = await findOrCreateUser(payload.email, payload.buyerName);

    const planType = resolvePlanType(payload.productCode, payload.offerCode);
    const plan = await systemPrisma.plan.findFirst({ where: { type: planType } });
    if (!plan) {
      return res.status(400).json({ error: `Plano não configurado para tipo ${planType}` });
    }

    const startsAt = payload.approvedDate ?? new Date();
    const endsAt = payload.endDate ?? periodEndByPlan(plan.type, startsAt);

    await systemPrisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        planId: plan.id,
        status,
        startsAt,
        endsAt,
      },
      update: {
        planId: plan.id,
        status,
        startsAt,
        endsAt,
      },
    });

    let welcomeEmailSent: boolean | null = null;
    let welcomeEmailNote: string | undefined;
    if (created && provisionalPassword) {
      const mail = await sendHotmartWelcomeEmail(user.email, provisionalPassword);
      welcomeEmailSent = mail.sent;
      if (!mail.sent && mail.reason) welcomeEmailNote = mail.reason;
    }

    return res.status(200).json({
      ok: true,
      user_id: user.id,
      user_created: created,
      ...(welcomeEmailSent !== null && { welcome_email_sent: welcomeEmailSent }),
      ...(welcomeEmailNote && { welcome_email_note: welcomeEmailNote }),
    });
  },
};
