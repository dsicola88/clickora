/**
 * A rede aprova a venda e o afiliado é avisado sem estar na dclickora.
 * O e-mail, o push e o Telegram ficam capturados aqui: não saem para fora.
 *
 *   DATABASE_URL=postgresql://postgres:e2e@127.0.0.1:55433/clickora_e2e \
 *     node --experimental-test-module-mocks --import tsx scripts/e2e-sale-notice.ts
 */
import { mock } from "node:test";

const sentMails: Array<{ to?: string; subject?: string; text?: string; html?: string }> = [];
const pushes: string[] = [];

mock.module("nodemailer", {
  defaultExport: {
    createTransport() {
      return {
        sendMail(msg: { to?: string; subject?: string; text?: string; html?: string }) {
          sentMails.push(msg);
          return Promise.resolve({ messageId: "e2e-sale" });
        },
      };
    },
  },
});

mock.module("web-push", {
  defaultExport: {
    setVapidDetails() {},
    sendNotification(_sub: unknown, body: string) {
      pushes.push(String(body));
      return Promise.resolve({});
    },
  },
});

const telegramHits: Array<{ chat_id?: string; text?: string }> = [];
const origFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("api.telegram.org")) {
    telegramHits.push(JSON.parse(String(init?.body || "{}")) as { chat_id?: string; text?: string });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return origFetch(input, init);
};

process.env.DATABASE_URL = "postgresql://postgres:e2e@127.0.0.1:55433/clickora_e2e";
process.env.PORT = "39991";
process.env.JWT_SECRET = "e2e-sale-notice-secret";
process.env.NODE_ENV = "test";
process.env.SMTP_FROM = "avisos@dclickora.test";
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "2525";
process.env.VAPID_PUBLIC_KEY = "e2e-public";
process.env.VAPID_PRIVATE_KEY = "e2e-private";
process.env.VAPID_SUBJECT = "mailto:avisos@dclickora.test";
process.env.FRONTEND_URL = "https://www.dclickora.com";
process.env.KEEP_ALIVE_URL = "http://127.0.0.1:39991";
process.env.QUIET_PRISMA = "1";

const BASE = "http://127.0.0.1:39991";
const OFFER = "https://offer.example/go";
const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

async function json(path: string, init: RequestInit = {}) {
  const res = await origFetch(`${BASE}${path}`, init);
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

async function waitFor(label: string, ready: () => boolean) {
  for (let i = 0; i < 30; i++) {
    if (ready()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`timeout: ${label}`);
}

async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (url.hostname !== "127.0.0.1" || url.port !== "55433" || url.pathname !== "/clickora_e2e") {
    throw new Error(`base recusada: ${url.host}${url.pathname}`);
  }

  const { systemPrisma } = await import("../src/lib/prisma.ts");
  const who = await systemPrisma.$queryRaw<Array<{ db: string }>>`SELECT current_database()::text AS db`;
  if (who[0]?.db !== "clickora_e2e") throw new Error(`base errada: ${who[0]?.db}`);

  await import("../src/server.ts");
  for (let i = 0; i < 40; i++) {
    try {
      const health = await origFetch(`${BASE}/api/health`);
      if (health.ok) break;
    } catch {
      /* ainda a arrancar */
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  const stamp = Date.now().toString(36);
  const accountEmail = `e2e-sale-${stamp}@clickora.test`;
  const alertEmail = `alertas-${stamp}@clickora.test`;
  const reg = await json("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: accountEmail,
      password: "e2e-sale-pass",
      full_name: "E2E Venda",
      accept_policies: true,
    }),
  });
  const token = (reg.body as { token?: string })?.token;
  if (!token || reg.res.status !== 201) throw new Error("registo falhou " + reg.res.status + " " + JSON.stringify(reg.body));
  const auth = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const me = await json("/api/auth/me", { headers: auth });
  const userId = (me.body as { id?: string })?.id;
  if (!userId) throw new Error("sem utilizador");

  const plan = await systemPrisma.plan.upsert({
    where: { id: "plan_e2e_webhook" },
    create: {
      id: "plan_e2e_webhook",
      name: "E2E webhook",
      type: "monthly",
      priceCents: 0,
      affiliateWebhookEnabled: true,
      maxPresellPages: 5,
    },
    update: { affiliateWebhookEnabled: true },
  });
  await systemPrisma.subscription.upsert({
    where: { userId },
    create: { userId, planId: plan.id, status: "active" },
    update: { planId: plan.id, status: "active" },
  });
  await systemPrisma.user.update({
    where: { id: userId },
    data: {
      saleNotifyEmail: alertEmail,
      telegramNotifySale: true,
      telegramBotToken: "123456:e2e-token",
      telegramChatId: "4242",
    },
  });
  await systemPrisma.webPushSubscription.create({
    data: {
      userId,
      endpoint: `https://push.example/e2e-${stamp}`,
      p256dh: "e2e-p256",
      auth: "e2e-auth",
    },
  });

  const created = await json("/api/presells", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      title: "Venda E2E",
      slug: `e2e-sale-${stamp}`,
      type: "tsl",
      status: "draft",
      content: { title: "Venda E2E", affiliateLink: OFFER, salesText: "Oferta" },
    }),
  });
  const pageId = (created.body as { id?: string })?.id;
  if (!pageId) throw new Error("presell " + JSON.stringify(created.body));

  /** Bypass compliance gate — este E2E valida avisos de venda, não ads publish. */
  await systemPrisma.presellPage.update({
    where: { id: pageId },
    data: { status: "published", complianceGate: "ready_for_review" },
  });
  record("presell forçada a published (bypass compliance)", true, pageId);

  const click = await origFetch(`${BASE}/api/track/r/${pageId}?to=${encodeURIComponent(OFFER)}`, {
    headers: { "user-agent": "Mozilla/5.0 Chrome/124", accept: "application/json" },
    redirect: "manual",
  });
  const location = click.headers.get("location") || "";
  const clickId = new URL(location, OFFER).searchParams.get("clickora_click_id");
  record("o clique saiu para a oferta", click.status === 302 && !!clickId, `status=${click.status}`);
  if (!clickId) throw new Error("sem click id");

  const hook = await json("/api/integrations/affiliate-webhook-info", { headers: auth });
  const hookUrl = (hook.body as { hook_url?: string })?.hook_url;
  if (!hook.res.ok || !hookUrl) throw new Error("webhook " + JSON.stringify(hook.body));
  const hookPath = new URL(hookUrl).pathname + new URL(hookUrl).search;

  async function postSale(params: Record<string, string>) {
    const sale = new URL(hookPath, BASE);
    for (const [k, v] of Object.entries(params)) sale.searchParams.set(k, v);
    const posted = await origFetch(sale, { headers: {} });
    const body = (await posted.json()) as {
      conversion?: string;
      email_sent?: boolean;
      email_note?: string;
      attribution?: string;
    };
    return { status: posted.status, body, hadAuth: posted.headers.get("x-test") };
  }

  const before = sentMails.length;
  const sale = await postSale({
    platform: "MaxWeb",
    clickora_click_id: clickId,
    amount: "21.85",
    currency: "USD",
    status: "approved",
    order_id: `ord-${stamp}`,
    product: "visivra_tsl2",
  });
  await waitFor("push e telegram da venda", () => pushes.length >= 1 && telegramHits.length >= 1);
  const mail = sentMails[sentMails.length - 1];
  const push = JSON.parse(pushes[0] || "{}") as { title?: string; body?: string; tag?: string; chime?: boolean };
  record(
    "venda aprovada avisa por e-mail sem sessão",
    sale.status === 200 &&
      sale.body.conversion === "created" &&
      sale.body.email_sent === true &&
      mail?.to === alertEmail &&
      (mail.subject || "").includes("MaxWeb") &&
      (mail.subject || "").includes("BuyGoods") === false &&
      (mail.text || "").includes("Produto: visivra_tsl2") &&
      (mail.text || "").includes("Comissão: 21,85 USD") &&
      (mail.text || "").includes("ligada a um clique") &&
      (mail.text || "").includes("conta fechada") &&
      mail.to !== accountEmail,
    `to=${mail?.to} sent=${sale.body.email_sent} note=${sale.body.email_note || ""}`,
  );
  record(
    "o telemóvel e o Telegram recebem o produto e a comissão",
    push.title === "Nova venda aprovada!" &&
      (push.body || "").includes("visivra_tsl2") &&
      (push.body || "").includes("Comissão: 21,85 USD") &&
      push.chime === true &&
      (push.tag || "").startsWith("sale-") &&
      telegramHits[0]?.chat_id === "4242" &&
      (telegramHits[0]?.text || "").includes("Produto: visivra_tsl2") &&
      (telegramHits[0]?.text || "").includes("Comissão: 21,85 USD"),
    `push=${push.body || ""} tg=${(telegramHits[0]?.text || "").split("\n")[0]}`,
  );

  const again = await postSale({
    clickora_click_id: clickId,
    amount: "21.85",
    currency: "USD",
    status: "approved",
    order_id: `ord-${stamp}`,
  });
  record(
    "a mesma encomenda não dispara segundo aviso",
    again.body.conversion === "duplicate" && sentMails.length === before + 1 && pushes.length === 1,
    `conversion=${again.body.conversion} emails=${sentMails.length - before} pushes=${pushes.length}`,
  );

  const pending = await postSale({
    clickora_click_id: clickId,
    amount: "4.00",
    currency: "USD",
    status: "pending",
    order_id: `pend-${stamp}`,
  });
  record(
    "venda pendente não avisa",
    pending.body.conversion === "pending" && sentMails.length === before + 1,
    `conversion=${pending.body.conversion} emails=${sentMails.length - before}`,
  );

  const approved = await postSale({
    clickora_click_id: clickId,
    amount: "4.00",
    currency: "USD",
    status: "approved",
    order_id: `pend-${stamp}`,
  });
  await waitFor("segundo push", () => pushes.length >= 2);
  record(
    "pendente que passa a aprovada avisa uma vez",
    approved.body.conversion === "approved_from_pending" &&
      approved.body.email_sent === true &&
      (sentMails.at(-1)?.text || "").includes("4,00 USD") &&
      pushes.length === 2 &&
      pushes[1] !== pushes[0],
    `conversion=${approved.body.conversion} pushes=${pushes.length}`,
  );

  const loose = await postSale({
    platform: "MaxWeb",
    amount: "9.00",
    currency: "USD",
    status: "approved",
    order_id: `loose-${stamp}`,
    product: "{PRODUCT_CODENAME}",
  });
  await waitFor("aviso sem clique", () => sentMails.length >= before + 3);
  record(
    "venda sem clique avisa e não inventa a ligação",
    loose.body.conversion === "created_unattributed" &&
      loose.body.email_sent === true &&
      (sentMails.at(-1)?.subject || "").includes("sem clique") &&
      (sentMails.at(-1)?.text || "").includes("não enviou o produto") &&
      (sentMails.at(-1)?.text || "").includes("PRODUCT_CODENAME") === false &&
      (sentMails.at(-1)?.text || "").includes("não devolveu o clique"),
    `conversion=${loose.body.conversion} subject=${sentMails.at(-1)?.subject}`,
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passaram`);
  await systemPrisma.$disconnect();
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 200);
  });
