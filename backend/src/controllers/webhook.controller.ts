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

/** Webhook 2.0: Hotmart envia `x-hotmart-signature` (HMAC-SHA256 do corpo bruto). */
function verifyHotmartSignature(req: Request, secret: string): boolean {
  const sigHeader = req.headers["x-hotmart-signature"];
  if (!sigHeader || typeof sigHeader !== "string") return false;
  const raw = req.rawBody;
  if (!raw || raw.length === 0) return false;

  const expectedHex = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const received = sigHeader.trim();
  const normalized = /^sha256=/i.test(received) ? received.replace(/^sha256=/i, "").trim() : received;

  try {
    const a = Buffer.from(normalized, "hex");
    const b = Buffer.from(expectedHex, "hex");
    if (a.length !== b.length || a.length === 0) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const LOOSE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Último recurso: eventos de assinatura/troca de plano guardam o e-mail noutros ramos do JSON. */
function deepFindEmail(obj: unknown, depth = 0): string | null {
  if (depth > 12 || obj == null) return null;
  if (typeof obj === "string" && LOOSE_EMAIL.test(obj.trim())) return obj.trim().toLowerCase();
  if (typeof obj !== "object") return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const e = deepFindEmail(item, depth + 1);
      if (e) return e;
    }
    return null;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (/email|mail|e-mail|buyer|subscriber|user/i.test(k) && typeof v === "string" && LOOSE_EMAIL.test(v.trim())) {
      return v.trim().toLowerCase();
    }
    const nested = deepFindEmail(v, depth + 1);
    if (nested) return nested;
  }
  return null;
}

function parseHotmartPayload(body: unknown): HotmartEventData | null {
  const root = asRecord(body);
  const data = asRecord(root.data);
  const buyer = asRecord(data.buyer);
  const purchase = asRecord(data.purchase);
  const subscription = asRecord(data.subscription);
  const subscriber = asRecord(data.subscriber);
  const user = asRecord(data.user);
  const product = asRecord(data.product);
  const offer = asRecord(data.offer);

  const event = pickString(
    root.event,
    data.event,
    purchase.status,
    subscription.status,
    subscription.event,
    root.name,
  );
  let email = pickString(
    buyer.email,
    purchase.buyer_email,
    subscriber.email,
    user.email,
    data.email,
    root.email,
    subscription.subscriber_email,
  );
  if (!email) {
    email = deepFindEmail(body);
  }

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

const VALID_PLAN_TYPES: PlanType[] = ["free_trial", "monthly", "quarterly", "annual"];

function resolvePlanType(productCode: string | null, offerCode: string | null): PlanType {
  const mapRaw = process.env.HOTMART_PLAN_MAP || "{}";
  const fallbackRaw = (process.env.HOTMART_DEFAULT_PLAN_TYPE as PlanType | undefined) || "monthly";
  const fallback = VALID_PLAN_TYPES.includes(fallbackRaw) ? fallbackRaw : "monthly";

  try {
    const map = JSON.parse(mapRaw) as Record<string, PlanType>;
    const code = offerCode || productCode;
    if (code && map[code] && VALID_PLAN_TYPES.includes(map[code])) return map[code];
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
  return `${base}/auth`;
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
    const expectedToken = process.env.HOTMART_WEBHOOK_TOKEN?.trim();
    if (expectedToken) {
      const hmacSecret = process.env.HOTMART_WEBHOOK_SECRET?.trim() || expectedToken;
      const plainOk = extractHotmartWebhookToken(req) === expectedToken;
      const hmacOk = verifyHotmartSignature(req, hmacSecret);
      if (!plainOk && !hmacOk) {
        return res.status(401).json({ error: "Webhook token inválido" });
      }
    }

    const payload = parseHotmartPayload(req.body);
    if (!payload) {
      // 200 evita retentativas infinitas na Hotmart para eventos com JSON diferente (ex.: troca de plano, módulo).
      console.warn("[hotmart-webhook] payload não reconhecido — evento ignorado (sem event+email)");
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: "payload_unrecognized",
      });
    }

    const status = normalizeSubscriptionStatus(payload.event);
    const { user, created, provisionalPassword } = await findOrCreateUser(payload.email, payload.buyerName);

    const planType = resolvePlanType(payload.productCode, payload.offerCode);
    const plan = await systemPrisma.plan.findFirst({ where: { type: planType } });
    if (!plan) {
      console.warn(`[hotmart-webhook] sem plano na BD para type=${planType} — ignorado (evita 400 na Hotmart)`);
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: "plan_not_configured",
        plan_type: planType,
      });
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
