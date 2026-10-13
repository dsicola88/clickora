/**
 * Liga a conta, envia a venda e grava o custo.
 * O ecrã de consentimento da Google não corre aqui: a API é simulada com o erro real
 * «login-customer-id» que a conta de produção recebeu.
 *
 *   DATABASE_URL=postgresql://postgres:e2e@127.0.0.1:55433/clickora_e2e \
 *     node --experimental-test-module-mocks --import tsx scripts/e2e-google-ads-one-click.ts
 */
import { mock } from "node:test";

const MANAGER = "1111111111";
const CLIENT = "2222222222";
const DIRECT = "3333333333";
const PERMISSION =
  "User doesn't have permission to access customer. Note: If you're accessing a client customer, the manager's customer id must be set in the 'login-customer-id' header.";

const COST_DAY = new Date().toISOString().slice(0, 10);
const uploads: Array<{ customerId: string; login: string | null; value: number; gclid: string | null }> = [];
let reuseAction = false;

function permissionError(): Error {
  const err = new Error("[object Object]");
  Object.assign(err, { errors: [{ message: PERMISSION }] });
  return err;
}

class GoogleAdsApi {
  listAccessibleCustomers(refreshToken: string) {
    if (refreshToken === "direct-token") return { resource_names: [`customers/${DIRECT}`] };
    return { resource_names: [`customers/${MANAGER}`, `customers/${CLIENT}`] };
  }

  Customer(opts: { customer_id: string; refresh_token: string; login_customer_id?: string }) {
    const login = opts.login_customer_id || null;
    return {
      async query(gaql: string) {
        if (opts.refresh_token === "mcc-self-token") {
          if (opts.customer_id === MANAGER && login !== MANAGER) throw permissionError();
          if (opts.customer_id === CLIENT && login !== MANAGER) throw permissionError();
        }
        if (opts.refresh_token === "mcc-blind-token") {
          if (opts.customer_id === MANAGER) throw permissionError();
          if (opts.customer_id === CLIENT && login !== MANAGER) throw permissionError();
        }
        if (opts.customer_id === CLIENT && !login) throw permissionError();
        if (gaql.includes("customer.manager") || gaql.includes("customer.descriptive_name")) {
          if (opts.customer_id === MANAGER) {
            return [{ customer: { descriptive_name: "Gestora", manager: true } }];
          }
          return [{ customer: { descriptive_name: "Anunciante", manager: false } }];
        }
        if (gaql.includes("customer_client")) return [];
        if (gaql.includes("conversion_action")) {
          if (!reuseAction) return [];
          return [{ conversion_action: { id: "999", name: "Clickora venda", status: "ENABLED" } }];
        }
        if (gaql.includes("FROM customer") && gaql.includes("segments.date")) {
          return [
            {
              segments: { date: COST_DAY },
              metrics: { cost_micros: 2_500_000, clicks: 4, impressions: 20 },
              customer: { currency_code: "EUR" },
            },
          ];
        }
        if (gaql.includes("keyword_view")) return [];
        return [];
      },
      conversionActions: {
        async create() {
          return { results: [{ resource_name: `customers/${opts.customer_id}/conversionActions/777` }] };
        },
      },
      conversionUploads: {
        async uploadClickConversions(request: { conversions?: Array<{ conversion_value?: number; gclid?: string }> }) {
          const row = request.conversions?.[0];
          uploads.push({
            customerId: opts.customer_id,
            login,
            value: Number(row?.conversion_value ?? 0),
            gclid: row?.gclid || null,
          });
          return { results: [{ ok: true }] };
        },
      },
    };
  }
}

mock.module("google-ads-api", {
  namedExports: {
    GoogleAdsApi,
    ResourceNames: {
      conversionAction: (customerId: string, actionId: string) =>
        `customers/${customerId}/conversionActions/${actionId}`,
    },
    enums: {
      ConversionActionType: { UPLOAD_CLICKS: "UPLOAD_CLICKS" },
      ConversionActionCategory: { PURCHASE: "PURCHASE" },
      ConversionActionStatus: { ENABLED: "ENABLED" },
    },
    services: {
      UploadClickConversionsRequest: class UploadClickConversionsRequest {
        conversions?: Array<{ conversion_value?: number; gclid?: string }>;
        constructor(data: { conversions?: Array<{ conversion_value?: number; gclid?: string }> }) {
          this.conversions = data.conversions;
        }
      },
    },
  },
});

const results: { name: string; ok: boolean; detail: string }[] = [];
function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

async function main() {
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN ||= "e2e-dev-token";
  process.env.GOOGLE_ADS_CLIENT_ID ||= "e2e-client";
  process.env.GOOGLE_ADS_CLIENT_SECRET ||= "e2e-secret";
  process.env.JWT_SECRET ||= "e2e-google-jwt-secret";
  process.env.API_PUBLIC_URL ||= "http://127.0.0.1:39991";
  process.env.FRONTEND_URL ||= "http://127.0.0.1:8080";

  const { PrismaClient } = await import("@prisma/client");
  const { bootstrapGoogleAdsAfterOAuth, syncConversionToGoogleAds } = await import(
    "../src/modules/googleAds/googleAds.service.ts"
  );
  const { syncAdCostsForUser, sumPersistedSpend } = await import("../src/modules/affiliateOps/costSync.service.ts");
  const prisma = new PrismaClient();

  const stamp = Date.now().toString(36);
  const mccUser = await prisma.user.create({
    data: { email: `e2e-gads-mcc-${stamp}@clickora.test`, password: "x", fullName: "E2E MCC", googleAdsRefreshToken: "mcc-token" },
  });
  const boot = await bootstrapGoogleAdsAfterOAuth(mccUser.id);
  record(
    "um clique escolhe a conta cliente e a gestora",
    boot.ok === true && boot.customer_id === CLIENT && boot.login_customer_id === MANAGER && boot.can_upload === true && boot.conversion_action_id === "777",
    `ok=${boot.ok} customer=${boot.customer_id} login=${boot.login_customer_id} action=${boot.conversion_action_id} ${boot.detail}`,
  );

  const page = await prisma.presellPage.create({
    data: { userId: mccUser.id, title: "Google E2E", slug: `e2e-gads-${stamp}`, type: "tsl", status: "published" },
  });
  const click = await prisma.trackingEvent.create({
    data: {
      userId: mccUser.id,
      presellPageId: page.id,
      eventType: "click",
      metadata: { gclid: "gclid-e2e-1" },
    },
  });
  const sale = await prisma.conversion.create({
    data: {
      userId: mccUser.id,
      clickId: click.id,
      presellId: page.id,
      amount: "12.50",
      currency: "EUR",
      status: "approved",
      attribution: "attributed",
      externalOrderId: `e2e-gads-${stamp}`,
    },
  });
  await syncConversionToGoogleAds(sale.id);
  const sent = await prisma.conversion.findUnique({ where: { id: sale.id }, select: { googleAdsSync: true } });
  const upload = uploads[0];
  record(
    "a venda aprovada segue para o Google com a comissão",
    sent?.googleAdsSync === "sent" && upload?.customerId === CLIENT && upload.login === MANAGER && upload.value === 12.5 && upload.gclid === "gclid-e2e-1",
    `sync=${sent?.googleAdsSync} login=${upload?.login} value=${upload?.value}`,
  );

  await syncAdCostsForUser(mccUser.id, 30);
  const spend = await sumPersistedSpend({
    userId: mccUser.id,
    from: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    to: new Date(Date.now() + 24 * 60 * 60 * 1000),
    platforms: ["google_ads"],
  });
  record(
    "o custo do período fica gravado",
    spend.total === 2.5 && spend.by_platform.google_ads === 2.5,
    `total=${spend.total} google=${spend.by_platform.google_ads ?? 0}`,
  );

  reuseAction = true;
  const again = await prisma.user.create({
    data: {
      email: `e2e-gads-again-${stamp}@clickora.test`,
      password: "x",
      fullName: "E2E again",
      googleAdsRefreshToken: "mcc-token",
      googleAdsCustomerId: CLIENT,
      googleAdsConversionActionId: "999",
      googleAdsEnabled: true,
    },
  });
  const re = await bootstrapGoogleAdsAfterOAuth(again.id);
  record(
    "conta já escolhida recebe a gestora sem novo formulário",
    re.ok === true && re.customer_id === CLIENT && re.login_customer_id === MANAGER && re.conversion_action_id === "999" && re.conversion_action_created === false,
    `login=${re.login_customer_id} action=${re.conversion_action_id} created=${re.conversion_action_created}`,
  );

  const direct = await prisma.user.create({
    data: {
      email: `e2e-gads-direct-${stamp}@clickora.test`,
      password: "x",
      fullName: "E2E direct",
      googleAdsRefreshToken: "direct-token",
      googleAdsLoginCustomerId: MANAGER,
    },
  });
  const directBoot = await bootstrapGoogleAdsAfterOAuth(direct.id);
  record(
    "conta directa não leva identificador de gestora",
    directBoot.ok === true && directBoot.customer_id === DIRECT && directBoot.login_customer_id == null,
    `customer=${directBoot.customer_id} login=${directBoot.login_customer_id ?? "vazio"} ${directBoot.detail}`,
  );

  const hiddenMcc = await prisma.user.create({
    data: {
      email: `e2e-gads-hidden-mcc-${stamp}@clickora.test`,
      password: "x",
      fullName: "E2E hidden mcc",
      googleAdsRefreshToken: "mcc-self-token",
      googleAdsCustomerId: CLIENT,
    },
  });
  const hiddenBoot = await bootstrapGoogleAdsAfterOAuth(hiddenMcc.id);
  record(
    "gestora que só responde com o próprio id fica gravada",
    hiddenBoot.ok === true && hiddenBoot.customer_id === CLIENT && hiddenBoot.login_customer_id === MANAGER,
    `customer=${hiddenBoot.customer_id} login=${hiddenBoot.login_customer_id ?? "vazio"} ${hiddenBoot.detail}`,
  );

  const blindMcc = await prisma.user.create({
    data: {
      email: `e2e-gads-blind-mcc-${stamp}@clickora.test`,
      password: "x",
      fullName: "E2E blind mcc",
      googleAdsRefreshToken: "mcc-blind-token",
      googleAdsCustomerId: CLIENT,
    },
  });
  const blindBoot = await bootstrapGoogleAdsAfterOAuth(blindMcc.id);
  record(
    "outra conta do login desbloqueia a leitura mesmo sem parecer gestora",
    blindBoot.ok === true && blindBoot.customer_id === CLIENT && blindBoot.login_customer_id === MANAGER,
    `customer=${blindBoot.customer_id} login=${blindBoot.login_customer_id ?? "vazio"} ${blindBoot.detail}`,
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passaram`);
  await prisma.$disconnect();
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
