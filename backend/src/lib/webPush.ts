import webpush from "web-push";
import { systemPrisma } from "./prisma";

let configured = false;

/**
 * Railway/Linux: `process.env` é sensível a maiúsculas; o painel por vezes cria `Vapid_Private_Key`
 * em vez de `VAPID_PRIVATE_KEY`.
 */
function envValueForKey(canonical: string): string | undefined {
  const direct = process.env[canonical];
  if (direct !== undefined) return direct;
  const found = Object.keys(process.env).find((k) => k.toUpperCase() === canonical.toUpperCase());
  return found ? process.env[found] : undefined;
}

/** Nomes alternativos por engano no painel (Railway). */
const VAPID_PRIVATE_FALLBACKS = [
  "VAPID_PRIVATE_KEY",
  "VAPID_PRIVATEKEY",
  "WEB_PUSH_VAPID_PRIVATE_KEY",
  "VAPID_PRIVATE",
];

function readVapidPrivateRaw(): string | undefined {
  for (const name of VAPID_PRIVATE_FALLBACKS) {
    const v = envValueForKey(name);
    if (v !== undefined && String(v).trim() !== "") return v;
  }
  const b64 = envValueForKey("VAPID_PRIVATE_KEY_B64");
  if (b64 !== undefined && String(b64).trim() !== "") {
    const dec = tryDecodeBase64Utf8(b64);
    if (dec) return dec;
    console.warn("[web-push] VAPID_PRIVATE_KEY_B64 definido mas não decodificou (Base64 inválido).");
  }
  const fuzzy = Object.keys(process.env).find((k) => {
    const u = k.toUpperCase();
    return u.includes("VAPID") && u.includes("PRIVATE") && !u.includes("PUBLIC");
  });
  return fuzzy ? process.env[fuzzy] : undefined;
}

const VAPID_PUBLIC_FALLBACKS = ["VAPID_PUBLIC_KEY", "VAPID_PUBLICKEY", "WEB_PUSH_VAPID_PUBLIC_KEY"];

function readVapidPublicRaw(): string | undefined {
  for (const name of VAPID_PUBLIC_FALLBACKS) {
    const v = envValueForKey(name);
    if (v !== undefined && String(v).trim() !== "") return v;
  }
  const fuzzy = Object.keys(process.env).find((k) => {
    const u = k.toUpperCase();
    return u.includes("VAPID") && u.includes("PUBLIC");
  });
  return fuzzy ? process.env[fuzzy] : undefined;
}

/** Base64 (ou base64url) → UTF-8; útil quando o painel corrompe `+`, `=` ou quebras no valor em claro. */
function tryDecodeBase64Utf8(raw: string | undefined): string | null {
  if (raw == null) return null;
  const t = stripVapidEnvValue(raw);
  if (!t) return null;
  const norm = t.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4;
  const padded = pad ? norm + "=".repeat(4 - pad) : norm;
  try {
    const buf = Buffer.from(padded, "base64");
    if (!buf.length) return null;
    const str = buf.toString("utf8");
    return str.trim() ? str : null;
  } catch {
    return null;
  }
}

function parseVapidKeysJsonObject(cleaned: string): { public: string; private: string } | null {
  try {
    const o = JSON.parse(cleaned) as Record<string, unknown>;
    const pub = o.public ?? o.publicKey;
    const priv = o.private ?? o.privateKey;
    const pubStr = typeof pub === "string" ? pub.trim() : "";
    const privStr = typeof priv === "string" ? priv.trim() : "";
    const mergedPub = pubStr || stripVapidEnvValue(readVapidPublicRaw()) || "";
    const mergedPriv = privStr || stripVapidEnvValue(readVapidPrivateRaw()) || "";
    if (mergedPub && mergedPriv) {
      return { public: mergedPub, private: mergedPriv };
    }
    console.warn("[web-push] VAPID_KEYS_JSON parseado mas falta public ou private (após merge com env).", {
      jsonKeys: Object.keys(o),
      mergedPublicLen: mergedPub.length,
      mergedPrivateLen: mergedPriv.length,
    });
  } catch (e) {
    console.warn("[web-push] VAPID_KEYS_JSON inválido (esperado JSON com public e private).", e);
  }
  return null;
}

/** Uma variável com JSON (Railway por vezes não injecta VAPID_PRIVATE_KEY sozinha). */
function readVapidKeysFromJsonBundle(): { public: string; private: string } | null {
  const candidates: string[] = [];
  const raw = envValueForKey("VAPID_KEYS_JSON");
  if (raw) {
    const cleaned = stripVapidEnvValue(raw);
    if (cleaned) candidates.push(cleaned);
  }
  const rawB64 = envValueForKey("VAPID_KEYS_JSON_B64");
  if (rawB64 !== undefined && stripVapidEnvValue(rawB64)) {
    const decoded = tryDecodeBase64Utf8(rawB64);
    if (decoded) {
      const cleaned = stripVapidEnvValue(decoded);
      if (cleaned) candidates.push(cleaned);
    } else {
      console.warn("[web-push] VAPID_KEYS_JSON_B64 definido mas não decodificou (Base64 inválido ou vazio).");
    }
  }
  for (const cleaned of candidates) {
    const r = parseVapidKeysJsonObject(cleaned);
    if (r) return r;
  }
  return null;
}

function resolvedVapidPublic(): string {
  const b = readVapidKeysFromJsonBundle();
  return stripVapidEnvValue(b?.public ?? readVapidPublicRaw());
}

function resolvedVapidPrivate(): string {
  const b = readVapidKeysFromJsonBundle();
  return stripVapidEnvValue(b?.private ?? readVapidPrivateRaw());
}

/** Remove aspas envolventes, quebras de linha e caracteres invisíveis (colar no Railway). */
function stripVapidEnvValue(raw: string | undefined): string {
  if (raw == null) return "";
  let s = raw
    .trim()
    .replace(/\r?\n/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Corrige mailto mal formado (ex.: dois @) que faz falhar o web-push.
 * Ex.: mailto:user@gmail.com@dominio.com -> mailto:user@gmail.com
 */
function normalizeVapidSubject(raw: string): string {
  let s = raw.trim();
  if (!s.toLowerCase().startsWith("mailto:")) {
    s = `mailto:${s}`;
  }
  const rest = s.slice("mailto:".length);
  const parts = rest.split("@");
  if (parts.length <= 2) return `mailto:${rest}`;
  return `mailto:${parts[0]}@${parts[1]}`;
}

export function initWebPushFromEnv(): void {
  if (configured) return;

  const pub = resolvedVapidPublic();
  const priv = resolvedVapidPrivate();
  const subjectRaw =
    stripVapidEnvValue(envValueForKey("VAPID_SUBJECT")) || "mailto:support@dclickora.com";
  const subject = normalizeVapidSubject(subjectRaw);

  if (!pub || !priv) {
    const rawPriv = readVapidPrivateRaw();
    const rawPub = readVapidPublicRaw();
    const bundle = readVapidKeysFromJsonBundle();
    const vapidNames = Object.keys(process.env).filter((k) => k.toUpperCase().includes("VAPID"));
    const rawJson = envValueForKey("VAPID_KEYS_JSON");
    const rawJsonB64 = envValueForKey("VAPID_KEYS_JSON_B64");
    const jsonStrippedLen = rawJson != null ? stripVapidEnvValue(rawJson).length : 0;
    const jsonB64StrippedLen = rawJsonB64 != null ? stripVapidEnvValue(rawJsonB64).length : 0;
    const rawPrivB64 = envValueForKey("VAPID_PRIVATE_KEY_B64");
    console.warn(
      "[web-push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY ausentes ou vazias após limpeza — notificações push desativadas.",
      {
        publicLen: pub.length,
        privateLen: priv.length,
        rawPublicDefined: rawPub !== undefined,
        rawPrivateDefined: rawPriv !== undefined,
        rawPublicLen: rawPub?.length ?? 0,
        rawPrivateLen: rawPriv?.length ?? 0,
        hasVapidKeysJson: rawJson !== undefined,
        vapidKeysJsonStrippedLen: jsonStrippedLen,
        hasVapidKeysJsonB64: rawJsonB64 !== undefined,
        vapidKeysJsonB64StrippedLen: jsonB64StrippedLen,
        hasVapidPrivateKeyB64: rawPrivB64 !== undefined,
        vapidKeysJsonValid: Boolean(bundle),
        envKeysContainingVapid: vapidNames,
        hint:
          "No serviço clickora: VAPID_PRIVATE_KEY em claro, ou VAPID_PRIVATE_KEY_B64 (chave privada em Base64), ou VAPID_KEYS_JSON / VAPID_KEYS_JSON_B64 (JSON numa linha). Redeploy após gravar.",
      },
    );
    return;
  }

  try {
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
    const fromJson = readVapidKeysFromJsonBundle() !== null;
    console.log(
      "[web-push] VAPID configurado.",
      "subject:",
      subject,
      fromJson ? "(chaves via VAPID_KEYS_JSON)" : "",
    );
  } catch (err) {
    console.error("[web-push] setVapidDetails falhou — verifique chaves e VAPID_SUBJECT (um mailto: válido).", err);
  }
}

/** Tenta de novo se o arranque correu antes das variáveis estarem disponíveis (raro). */
export function ensureWebPushFromEnv(): void {
  initWebPushFromEnv();
}

export function isWebPushConfigured(): boolean {
  return configured;
}

export function getVapidPublicKeyFromEnv(): string | null {
  const k = resolvedVapidPublic();
  return k || null;
}

export type WebPushPayload = {
  title: string;
  body: string;
  /** Caminho relativo (ex. /tracking/dashboard) ou URL absoluta */
  url?: string;
};

/**
 * Envia notificação a todas as subscrições do utilizador. Remove subscrições expiradas (410/404).
 *
 * Multi-tenant: `userId` deve ser sempre o dono da conta (ex.: dono da conversão no webhook).
 * Não aceitar `userId` vindo do cliente sem validação de tenant.
 */
export async function sendWebPushToUser(userId: string, payload: WebPushPayload): Promise<void> {
  ensureWebPushFromEnv();
  if (!configured) return;

  const subs = await systemPrisma.webPushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/tracking/dashboard",
  });

  const toRemove: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      const pushSub = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      try {
        await webpush.sendNotification(pushSub, body);
      } catch (err: unknown) {
        const status = typeof err === "object" && err !== null && "statusCode" in err ? (err as { statusCode?: number }).statusCode : undefined;
        if (status === 410 || status === 404) {
          toRemove.push(s.id);
        } else {
          console.warn("[web-push] send failed", userId, status, err);
        }
      }
    }),
  );

  if (toRemove.length > 0) {
    await systemPrisma.webPushSubscription.deleteMany({
      where: { id: { in: toRemove } },
    });
  }
}
