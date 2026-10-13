/**
 * Limites dos planos contra a API local. Só a base clickora_e2e em 127.0.0.1:55433.
 *
 *   DATABASE_URL=postgresql://postgres:e2e@127.0.0.1:55433/clickora_e2e \
 *     node --import tsx scripts/e2e-plan-limits-audit.ts
 */
process.env.DATABASE_URL = "postgresql://postgres:e2e@127.0.0.1:55433/clickora_e2e";
process.env.PORT = "39992";
process.env.JWT_SECRET = "e2e-plan-limits-audit-secret";
process.env.NODE_ENV = "test";
process.env.FRONTEND_URL = "https://www.dclickora.com";
process.env.KEEP_ALIVE_URL = "http://127.0.0.1:39992";
process.env.QUIET_PRISMA = "1";
process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "e2e-not-a-real-token";
process.env.GOOGLE_ADS_CLIENT_ID = "e2e-client";
process.env.GOOGLE_ADS_CLIENT_SECRET = "e2e-secret";

const BASE = "http://127.0.0.1:39992";
const OFFER = "https://offer.example/go";
const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

async function json(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

async function register(email: string) {
  const reg = await json("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: "e2e-plan-audit-pass",
      full_name: "Auditoria planos",
      accept_policies: true,
    }),
  });
  const token = (reg.body as { token?: string })?.token;
  if (!token || reg.res.status !== 201) {
    throw new Error(`registo ${email} ${reg.res.status} ${JSON.stringify(reg.body)}`);
  }
  const auth = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const me = await json("/api/auth/me", { headers: auth });
  const userId = (me.body as { id?: string })?.id;
  if (!userId) throw new Error("sem utilizador");
  return { token, auth, userId };
}

async function createPage(auth: Record<string, string>, slug: string) {
  return json("/api/presells", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      title: slug,
      slug,
      type: "tsl",
      status: "published",
      content: { title: slug, affiliateLink: OFFER, salesText: "Oferta" },
    }),
  });
}

async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (url.hostname !== "127.0.0.1" || url.port !== "55433" || url.pathname !== "/clickora_e2e") {
    throw new Error(`base recusada: ${url.host}${url.pathname}`);
  }

  const { systemPrisma } = await import("../src/lib/prisma.ts");
  const who = await systemPrisma.$queryRaw<Array<{ db: string; host: string }>>`
    SELECT current_database()::text AS db, inet_server_addr()::text AS host
  `;
  if (who[0]?.db !== "clickora_e2e") throw new Error(`base errada: ${JSON.stringify(who[0])}`);
  console.log(`base ${who[0]?.db} em ${who[0]?.host}`);

  const { createPostbackToken } = await import("../src/lib/postbackToken.ts");

  await systemPrisma.plan.upsert({
    where: { id: "plan_audit_starter" },
    create: {
      id: "plan_audit_starter",
      name: "Starter",
      type: "free_trial",
      priceCents: 0,
      maxPresellPages: 3,
      maxClicksPerMonth: 100,
      maxCustomDomains: 0,
      hasBranding: true,
      affiliateWebhookEnabled: false,
      dpilotAdsEnabled: false,
    },
    update: {
      maxPresellPages: 3,
      maxClicksPerMonth: 100,
      maxCustomDomains: 0,
      affiliateWebhookEnabled: false,
      dpilotAdsEnabled: false,
    },
  });
  await systemPrisma.plan.upsert({
    where: { id: "plan_audit_monthly" },
    create: {
      id: "plan_audit_monthly",
      name: "Pro Mensal",
      type: "monthly",
      priceCents: 2400,
      maxPresellPages: 25,
      maxClicksPerMonth: 150000,
      maxCustomDomains: 1,
      hasBranding: false,
      affiliateWebhookEnabled: true,
      dpilotAdsEnabled: false,
    },
    update: {
      maxPresellPages: 25,
      maxClicksPerMonth: 150000,
      maxCustomDomains: 1,
      affiliateWebhookEnabled: true,
      dpilotAdsEnabled: false,
    },
  });
  await systemPrisma.plan.upsert({
    where: { id: "plan_audit_annual" },
    create: {
      id: "plan_audit_annual",
      name: "Pro Anual",
      type: "annual",
      priceCents: 19600,
      maxPresellPages: null,
      maxClicksPerMonth: null,
      maxCustomDomains: 2,
      hasBranding: false,
      affiliateWebhookEnabled: true,
      dpilotAdsEnabled: true,
    },
    update: {
      maxPresellPages: null,
      maxClicksPerMonth: null,
      maxCustomDomains: 2,
      affiliateWebhookEnabled: true,
      dpilotAdsEnabled: true,
    },
  });

  await import("../src/server.ts");
  for (let i = 0; i < 40; i++) {
    try {
      const health = await fetch(`${BASE}/api/health`);
      if (health.ok) break;
    } catch {
      /* a arrancar */
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  const stamp = Date.now().toString(36);
  const starter = await register(`e2e-starter-${stamp}@clickora.test`);
  const monthly = await register(`e2e-monthly-${stamp}@clickora.test`);
  const annual = await register(`e2e-annual-${stamp}@clickora.test`);

  async function assign(userId: string, planId: string) {
    await systemPrisma.subscription.upsert({
      where: { userId },
      create: { userId, planId, status: "active" },
      update: { planId, status: "active" },
    });
  }
  await assign(starter.userId, "plan_audit_starter");
  await assign(monthly.userId, "plan_audit_monthly");
  await assign(annual.userId, "plan_audit_annual");

  const pageIds: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const created = await createPage(starter.auth, `audit-st-${stamp}-${i}`);
    if (created.res.status === 201 || (created.body as { id?: string })?.id) {
      pageIds.push((created.body as { id: string }).id);
    }
    record(`starter página ${i}`, created.res.status === 201, `status=${created.res.status}`);
  }
  const fourth = await createPage(starter.auth, `audit-st-${stamp}-4`);
  record(
    "starter recusa a 4.ª página",
    fourth.res.status === 403 && String((fourth.body as { error?: string })?.error || "").includes("Limite de 3"),
    `status=${fourth.res.status} ${JSON.stringify(fourth.body)}`,
  );

  const pageId = pageIds[0];
  if (!pageId) throw new Error("sem página");

  const now = new Date();
  const thisMonth = Array.from({ length: 100 }, () => ({
    userId: starter.userId,
    presellPageId: pageId,
    eventType: "click" as const,
    createdAt: now,
    metadata: {},
  }));
  await systemPrisma.trackingEvent.createMany({ data: thisMonth });
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 12, 0, 0));
  await systemPrisma.trackingEvent.createMany({
    data: Array.from({ length: 40 }, () => ({
      userId: starter.userId,
      presellPageId: pageId,
      eventType: "click" as const,
      createdAt: lastMonth,
      metadata: {},
    })),
  });
  const boundary = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  boundary.setTime(boundary.getTime() - 30 * 60 * 1000);
  await systemPrisma.trackingEvent.create({
    data: {
      userId: starter.userId,
      presellPageId: pageId,
      eventType: "click",
      createdAt: boundary,
      metadata: { audit: "month-boundary" },
    },
  });

  const localMonthStart = new Date();
  localMonthStart.setDate(1);
  localMonthStart.setHours(0, 0, 0, 0);
  const utcMonthStart = new Date();
  utcMonthStart.setUTCDate(1);
  utcMonthStart.setUTCHours(0, 0, 0, 0);
  const trackCount = await systemPrisma.trackingEvent.count({
    where: { userId: starter.userId, eventType: "click", createdAt: { gte: localMonthStart } },
  });
  const panelCount = await systemPrisma.trackingEvent.count({
    where: { userId: starter.userId, eventType: "click", createdAt: { gte: utcMonthStart } },
  });
  record(
    "cliques do mês anterior não entram na quota deste mês",
    panelCount < 141,
    `painel UTC=${panelCount} track local=${trackCount} mês anterior=40 fronteira=${boundary.toISOString()} localStart=${localMonthStart.toISOString()} utcStart=${utcMonthStart.toISOString()}`,
  );
  const { countPlanClicksThisMonth } = await import("../src/lib/planClickQuota.ts");
  const quotaBefore = await countPlanClicksThisMonth(starter.userId);
  record(
    "a quota do aviso e a do painel partem da mesma conta",
    quotaBefore === panelCount,
    `quota=${quotaBefore} painel UTC=${panelCount} track local=${trackCount}`,
  );

  const extra = await fetch(`${BASE}/api/track/r/${pageId}?to=${encodeURIComponent(OFFER)}`, {
    headers: { "user-agent": "Mozilla/5.0 Chrome/124", accept: "application/json" },
    redirect: "manual",
  });
  record(
    "o 101.º clique do mês ainda segue para a oferta",
    extra.status === 302,
    `status=${extra.status} location=${extra.headers.get("location") ? "sim" : "não"}`,
  );

  const dash = await json(`/api/analytics/dashboard?from=2026-09-01&to=2026-10-13`, { headers: starter.auth });
  const dashBody = dash.body as {
    click_quota?: { used?: number; max?: number | null; over_limit?: boolean; soft_cap?: boolean };
    media_buyer?: { spend?: number | null; spend_source?: string; profit?: number | null };
    google_ads_metrics?: unknown;
    google_ads_metrics_error?: string | null;
    approved_sales_count?: number;
    total_conversions?: number;
  };
  record(
    "o painel marca a quota de 100 como ultrapassada e não corta",
    dash.res.status === 200 &&
      dashBody.click_quota?.max === 100 &&
      dashBody.click_quota?.used === quotaBefore + 1 &&
      dashBody.click_quota?.over_limit === true &&
      dashBody.click_quota?.soft_cap === true,
    JSON.stringify(dashBody.click_quota),
  );
  record(
    "sem leitura do Google o custo fica vazio",
    dashBody.media_buyer?.spend == null &&
      dashBody.media_buyer?.spend_source === "none" &&
      dashBody.google_ads_metrics == null &&
      dashBody.media_buyer?.profit == null,
    `spend=${dashBody.media_buyer?.spend} source=${dashBody.media_buyer?.spend_source} metrics=${dashBody.google_ads_metrics} err=${dashBody.google_ads_metrics_error}`,
  );

  let monthlyOk = 0;
  for (let i = 1; i <= 25; i++) {
    const created = await createPage(monthly.auth, `audit-mo-${stamp}-${i}`);
    if (created.res.status === 201) monthlyOk += 1;
  }
  const monthly26 = await createPage(monthly.auth, `audit-mo-${stamp}-26`);
  record(
    "pro mensal aceita 25 páginas e recusa a 26.ª",
    monthlyOk === 25 && monthly26.res.status === 403,
    `criadas=${monthlyOk} 26=${monthly26.res.status}`,
  );

  let annualOk = 0;
  for (let i = 1; i <= 26; i++) {
    const created = await createPage(annual.auth, `audit-an-${stamp}-${i}`);
    if (created.res.status === 201) annualOk += 1;
  }
  record("pro anual não trava nas 26 páginas", annualOk === 26, `criadas=${annualOk}`);

  async function addDomain(auth: Record<string, string>, host: string) {
    return json("/api/custom-domain", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ hostname: host }),
    });
  }
  const stDomain = await addDomain(starter.auth, `st-${stamp}.audit.example`);
  record(
    "starter não cria domínio",
    stDomain.res.status === 403 &&
      String((stDomain.body as { error?: string })?.error || "").includes("não inclui domínio próprio"),
    `status=${stDomain.res.status} ${JSON.stringify(stDomain.body)}`,
  );
  const mo1 = await addDomain(monthly.auth, `mo-${stamp}.audit.example`);
  const mo2 = await addDomain(monthly.auth, `mo2-${stamp}.audit.example`);
  record(
    "pro mensal aceita 1 domínio e recusa o 2.º",
    mo1.res.status === 201 && mo2.res.status === 403,
    `1=${mo1.res.status} 2=${mo2.res.status}`,
  );
  const an1 = await addDomain(annual.auth, `an1-${stamp}.audit.example`);
  const an2 = await addDomain(annual.auth, `an2-${stamp}.audit.example`);
  const an3 = await addDomain(annual.auth, `an3-${stamp}.audit.example`);
  record(
    "pro anual aceita 2 domínios e recusa o 3.º",
    an1.res.status === 201 && an2.res.status === 201 && an3.res.status === 403,
    `1=${an1.res.status} 2=${an2.res.status} 3=${an3.res.status}`,
  );

  const paidMonthly = await json("/api/paid/projects", { headers: monthly.auth });
  const paidAnnual = await json("/api/paid/projects", { headers: annual.auth });
  const paidStarter = await json("/api/paid/projects", { headers: starter.auth });
  record(
    "preparar anúncios só abre no pro anual",
    paidStarter.res.status === 403 &&
      paidMonthly.res.status === 403 &&
      paidAnnual.res.status === 200 &&
      Array.isArray((paidAnnual.body as { projects?: unknown })?.projects ?? paidAnnual.body),
    `starter=${paidStarter.res.status} mensal=${paidMonthly.res.status} anual=${paidAnnual.res.status}`,
  );

  const starterHook = await json("/api/integrations/affiliate-webhook-info", { headers: starter.auth });
  const starterToken = createPostbackToken(starter.userId);
  const starterSale = await json(
    `/api/integrations/affiliate-webhook?token=${encodeURIComponent(starterToken || "")}&status=approved&amount=10&currency=USD&order_id=st-${stamp}`,
    { method: "POST" },
  );
  const starterSales = await systemPrisma.conversion.count({ where: { userId: starter.userId } });
  record(
    "starter não recebe o aviso de vendas nem grava conversão",
    starterHook.res.status === 403 && starterSale.res.status === 403 && starterSales === 0,
    `info=${starterHook.res.status} post=${starterSale.res.status} conversoes=${starterSales}`,
  );

  const monthlyHook = await json("/api/integrations/affiliate-webhook-info", { headers: monthly.auth });
  const hookUrl = (monthlyHook.body as { hook_url?: string })?.hook_url;
  record("pro mensal recebe o endereço do aviso de vendas", monthlyHook.res.status === 200 && Boolean(hookUrl), `status=${monthlyHook.res.status}`);
  if (!hookUrl) throw new Error("sem webhook mensal");
  const hook = new URL(hookUrl);

  async function postNet(params: Record<string, string>) {
    const sale = new URL(hook.pathname + hook.search, BASE);
    for (const [k, v] of Object.entries(params)) sale.searchParams.set(k, v);
    return json(sale.pathname + sale.search, { method: "POST" });
  }

  const pending = await postNet({ status: "pending", amount: "8", currency: "USD", order_id: `pend-${stamp}` });
  const afterPending = await json("/api/analytics/dashboard?from=2026-10-01&to=2026-10-13", { headers: monthly.auth });
  const pendingBody = afterPending.body as { approved_sales_count?: number; revenue?: number };
  const pendingRows = await systemPrisma.conversion.count({
    where: { userId: monthly.userId, status: "pending" },
  });
  record(
    "venda ainda por confirmar não entra nas vendas do painel",
    pending.res.status === 200 && pendingRows >= 1 && pendingBody.approved_sales_count === 0 && pendingBody.revenue === 0,
    `post=${pending.res.status} pendentes=${pendingRows} aprovadas=${pendingBody.approved_sales_count} receita=${pendingBody.revenue}`,
  );

  const approved = await postNet({
    status: "approved",
    amount: "12.5",
    currency: "USD",
    order_id: `ok-${stamp}`,
  });
  const afterOk = await json("/api/analytics/dashboard?from=2026-10-01&to=2026-10-13", { headers: monthly.auth });
  const okBody = afterOk.body as { approved_sales_count?: number; revenue?: number; total_conversions?: number };
  record(
    "só a venda confirmada pela rede entra no painel",
    approved.res.status === 200 && okBody.approved_sales_count === 1 && okBody.total_conversions === 1 && okBody.revenue === 12.5,
    `post=${approved.res.status} body=${JSON.stringify(approved.body)} aprovadas=${okBody.approved_sales_count} receita=${okBody.revenue}`,
  );

  await systemPrisma.plan.update({
    where: { id: "plan_audit_monthly" },
    data: {
      name: "Plano editado",
      priceCents: 3300,
      maxPresellPages: 7,
      maxClicksPerMonth: 42,
      maxCustomDomains: 4,
      affiliateWebhookEnabled: false,
      dpilotAdsEnabled: true,
      features: ["Frase escrita pelo superadmin"],
    },
  });
  const publicPlans = await json("/api/plans");
  const edited = (Array.isArray(publicPlans.body) ? publicPlans.body : []).find(
    (p) => (p as { id?: string }).id === "plan_audit_monthly",
  ) as {
    name?: string;
    price_cents?: number;
    max_presell_pages?: number | null;
    max_clicks_per_month?: number | null;
    max_custom_domains?: number;
    affiliate_webhook_enabled?: boolean;
    dpilot_ads_enabled?: boolean;
    features?: string[];
  } | undefined;
  record(
    "a página pública mostra os números gravados no plano",
    publicPlans.res.status === 200 &&
      edited?.name === "Plano editado" &&
      edited.price_cents === 3300 &&
      edited.max_presell_pages === 7 &&
      edited.max_clicks_per_month === 42 &&
      edited.max_custom_domains === 4 &&
      edited.affiliate_webhook_enabled === false &&
      edited.dpilot_ads_enabled === true &&
      edited.features?.[0] === "Frase escrita pelo superadmin",
    JSON.stringify(edited),
  );
  const afterEditPage = await createPage(monthly.auth, `audit-mo-${stamp}-extra`);
  const afterEditDomain = await addDomain(monthly.auth, `mo3-${stamp}.audit.example`);
  const afterEditAds = await json("/api/paid/projects", { headers: monthly.auth });
  const afterEditHook = await json("/api/integrations/affiliate-webhook-info", { headers: monthly.auth });
  record(
    "a conta passa a obedecer os novos limites e interruptores",
    afterEditPage.res.status === 403 &&
      afterEditDomain.res.status === 201 &&
      afterEditAds.res.status === 200 &&
      afterEditHook.res.status === 403,
    `página=${afterEditPage.res.status} domínio=${afterEditDomain.res.status} anúncios=${afterEditAds.res.status} aviso=${afterEditHook.res.status}`,
  );

  const note = "Nota de páginas escrita pelo superadmin.";
  const subtitle = "Subtítulo dos planos escrito pelo superadmin.";
  await systemPrisma.plansLandingConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      heroTitle: "Título configurado",
      planDisplayLabels: { note_pages_cap: note },
      landingExtras: { plans_section_subtitle: subtitle },
    },
    update: {
      heroTitle: "Título configurado",
      planDisplayLabels: { note_pages_cap: note },
      landingExtras: { plans_section_subtitle: subtitle },
    },
  });
  const landing = await json("/api/public/plans-landing");
  const landingBody = landing.body as {
    hero_title?: string;
    plan_display_labels?: { note_pages_cap?: string };
    landing_extras?: { plans_section_subtitle?: string };
  };
  record(
    "os textos da página de vendas saem da configuração gravada",
    landing.res.status === 200 &&
      landingBody.hero_title === "Título configurado" &&
      landingBody.plan_display_labels?.note_pages_cap === note &&
      landingBody.landing_extras?.plans_section_subtitle === subtitle,
    `status=${landing.res.status} titulo=${landingBody.hero_title} nota=${landingBody.plan_display_labels?.note_pages_cap} sub=${landingBody.landing_extras?.plans_section_subtitle}`,
  );

  const editor = await register(`audit-editor-${stamp}@example.com`);
  await systemPrisma.userRole.create({ data: { userId: editor.userId, role: "super_admin" } });
  const strangerPatch = await json(`/api/admin/plans/plan_audit_monthly`, {
    method: "PATCH",
    headers: starter.auth,
    body: JSON.stringify({ name: "Não autorizado" }),
  });
  const badPhrase = await json(`/api/admin/plans/plan_audit_monthly`, {
    method: "PATCH",
    headers: editor.auth,
    body: JSON.stringify({ features: ["Até 50.000 cliques/mês"] }),
  });
  const goodPhrase = await json(`/api/admin/plans/plan_audit_monthly`, {
    method: "PATCH",
    headers: editor.auth,
    body: JSON.stringify({ features: ["Frase sem número de quota"] }),
  });
  const afterPhrase = await json("/api/plans");
  const phrased = (Array.isArray(afterPhrase.body) ? afterPhrase.body : []).find(
    (p) => (p as { id?: string }).id === "plan_audit_monthly",
  ) as { features?: string[] } | undefined;
  const zeroPrice = await json(`/api/admin/plans/plan_audit_monthly`, {
    method: "PATCH",
    headers: editor.auth,
    body: JSON.stringify({ price_cents: 0 }),
  });
  const priceRow = await systemPrisma.plan.findUnique({
    where: { id: "plan_audit_monthly" },
    select: { priceCents: true },
  });
  record(
    "sem permissão de superadmin o plano não muda",
    strangerPatch.res.status === 403,
    `status=${strangerPatch.res.status}`,
  );
  record(
    "frase com número de cliques é recusada e a frase livre fica gravada",
    badPhrase.res.status === 400 &&
      goodPhrase.res.status === 200 &&
      phrased?.features?.[0] === "Frase sem número de quota",
    `ruim=${badPhrase.res.status} boa=${goodPhrase.res.status} features=${JSON.stringify(phrased?.features)}`,
  );
  record(
    "plano pago não fica a zero",
    zeroPrice.res.status === 400 && priceRow?.priceCents === 3300,
    `status=${zeroPrice.res.status} preço=${priceRow?.priceCents}`,
  );

  const beforeFree = await systemPrisma.subscription.findUnique({
    where: { userId: monthly.userId },
    select: { planId: true },
  });
  const joinFree = await json("/api/plans/subscribe", {
    method: "POST",
    headers: monthly.auth,
    body: JSON.stringify({ plan_id: "plan_audit_starter" }),
  });
  const afterFree = await systemPrisma.subscription.findUnique({
    where: { userId: monthly.userId },
    select: { planId: true },
  });
  record(
    "o plano grátis a zero ainda pode ser ativado",
    joinFree.res.status === 200 && afterFree?.planId === "plan_audit_starter",
    `antes=${beforeFree?.planId} status=${joinFree.res.status} depois=${afterFree?.planId}`,
  );

  await systemPrisma.plan.update({ where: { id: "plan_audit_monthly" }, data: { priceCents: 0 } });
  const beforePaid = await systemPrisma.subscription.findUnique({
    where: { userId: starter.userId },
    select: { planId: true },
  });
  const joinPaid = await json("/api/plans/subscribe", {
    method: "POST",
    headers: starter.auth,
    body: JSON.stringify({ plan_id: "plan_audit_monthly" }),
  });
  const afterPaid = await systemPrisma.subscription.findUnique({
    where: { userId: starter.userId },
    select: { planId: true },
  });
  record(
    "plano pago gravado a zero não muda a assinatura",
    joinPaid.res.status === 409 && afterPaid?.planId === beforePaid?.planId,
    `status=${joinPaid.res.status} antes=${beforePaid?.planId} depois=${afterPaid?.planId}`,
  );

  await systemPrisma.plan.update({
    where: { id: "plan_audit_starter" },
    data: {
      maxPresellPages: 0,
      maxClicksPerMonth: 0,
      features: ["Até 3 presell pages · 1.000 cliques/mês (trial)"],
    },
  });
  const zeroPage = await createPage(starter.auth, `audit-zero-${stamp}`);
  const zeroClick = await fetch(`${BASE}/api/track/r/${pageId}?to=${encodeURIComponent(OFFER)}`, {
    headers: { "user-agent": "Mozilla/5.0 Chrome/124", accept: "application/json" },
    redirect: "manual",
  });
  const zeroDash = await json("/api/analytics/dashboard?from=2026-10-01&to=2026-10-13", { headers: starter.auth });
  const zeroQuota = (zeroDash.body as { click_quota?: { max?: number | null; over_limit?: boolean } }).click_quota;
  const publicAfterStale = await json("/api/plans");
  const staleShown = (Array.isArray(publicAfterStale.body) ? publicAfterStale.body : []).find(
    (p) => (p as { id?: string }).id === "plan_audit_starter",
  ) as { features?: string[]; max_presell_pages?: number | null; max_clicks_per_month?: number | null } | undefined;
  record(
    "zero páginas recusa criar e zero cliques não corta o anúncio",
    zeroPage.res.status === 403 &&
      zeroClick.status === 302 &&
      zeroQuota?.max === 0 &&
      zeroQuota?.over_limit === true &&
      staleShown?.max_presell_pages === 0 &&
      staleShown?.max_clicks_per_month === 0,
    `página=${zeroPage.res.status} clique=${zeroClick.status} quota=${JSON.stringify(zeroQuota)}`,
  );
  record(
    "a frase velha com 1.000 cliques não sai na página",
    staleShown?.features?.[0] ===
      "Páginas e cliques deste plano são os números do cartão. Ao passar a quota de cliques, o anúncio continua.",
    JSON.stringify(staleShown?.features),
  );

  const oldSubtitle =
    "Compare presells, cliques e o que cada plano inclui. Os números são os limites da conta, não uma previsão de vendas. O plano grátis não pede cartão nesta página.";
  await systemPrisma.plansLandingConfig.update({
    where: { id: "default" },
    data: {
      planDisplayLabels: { branding_no: "Sem marca Clickora" },
      landingExtras: {
        plans_section_subtitle: oldSubtitle,
        features: {
          cards: [
            {
              title: "Onde vale a pena gastar",
              body: "A campanha e a palavra-chave ficam ao lado da venda confirmada. Vê o que trouxe resultado e o que só gastou. A decisão de aumentar o orçamento é sua, com os dados juntos.",
            },
          ],
        },
        faq: {
          items: [
            {
              q: "Como funciona o pagamento Hotmart?",
              a: "Nos planos pagos, o botão Compra abre o checkout Hotmart (se HOTMART_PRODUCT_URL ou HOTMART_PLAN_CHECKOUT_URLS estiver configurado no servidor). Após pagamento aprovado, o webhook Hotmart activa a assinatura — use o mesmo e-mail na Hotmart e na Clickora. Se o link não estiver configurado, verá um aviso em vez do redirect.",
            },
          ],
        },
      },
    },
  });
  const staleLanding = await json("/api/public/plans-landing");
  const staleExtras = (staleLanding.body as {
    plan_display_labels?: { branding_no?: string };
    landing_extras?: {
      plans_section_subtitle?: string;
      features?: { cards?: { title?: string; body?: string }[] };
      faq?: { items?: { a?: string }[] };
    };
  }).landing_extras;
  const staleLabels = (staleLanding.body as { plan_display_labels?: { branding_no?: string } }).plan_display_labels;
  record(
    "as sete frases velhas saem já corrigidas na leitura",
    staleLabels?.branding_no === "Pode retirar a marca" &&
      staleExtras?.plans_section_subtitle?.includes("o anúncio não é cortado") === true &&
      staleExtras?.features?.cards?.[0]?.title === "Campanha e venda juntas" &&
      staleExtras?.features?.cards?.[0]?.body?.includes("quando o Google aceita a leitura") === true &&
      staleExtras?.faq?.items?.[0]?.a?.includes("HOTMART_PRODUCT_URL") === false,
    `marca=${staleLabels?.branding_no} sub=${staleExtras?.plans_section_subtitle} titulo=${staleExtras?.features?.cards?.[0]?.title} faq=${staleExtras?.faq?.items?.[0]?.a}`,
  );

  const { readFileSync } = await import("node:fs");
  const phraseSql = readFileSync(
    "prisma/migrations/20261013121000_align_stored_plan_phrases/migration.sql",
    "utf8",
  );
  const statements = phraseSql
    .split(/;\s*\n/)
    .map((part) => part.replace(/--[^\n]*/g, "").trim())
    .filter(Boolean);
  for (const statement of statements) {
    await systemPrisma.$executeRawUnsafe(statement);
  }
  const storedPlan = await systemPrisma.plan.findUnique({
    where: { id: "plan_audit_starter" },
    select: { features: true },
  });
  const storedLanding = await systemPrisma.plansLandingConfig.findUnique({
    where: { id: "default" },
    select: { landingExtras: true, planDisplayLabels: true },
  });
  const storedFeatures = JSON.stringify(storedPlan?.features ?? "");
  const storedExtras = JSON.stringify(storedLanding?.landingExtras ?? "");
  const storedLabels = JSON.stringify(storedLanding?.planDisplayLabels ?? "");
  const indexes = await systemPrisma.$queryRawUnsafe<Array<{ indexname: string }>>(
    "SELECT indexname FROM pg_indexes WHERE tablename = 'custom_domains' AND indexname = 'custom_domains_user_id_key'",
  );
  record(
    "a migração grava as frases novas e não mexe nos números",
    !storedFeatures.includes("1.000 cliques") &&
      storedFeatures.includes("números do cartão") &&
      !storedExtras.includes("HOTMART_PRODUCT_URL") &&
      !storedExtras.includes("o que só gastou") &&
      !storedExtras.includes("Os números são os limites da conta") &&
      storedLabels.includes("Pode retirar a marca") &&
      staleShown?.max_presell_pages === 0,
    `features=${storedFeatures} extras=${storedExtras.slice(0, 280)} labels=${storedLabels}`,
  );
  record(
    "nesta base descartável o índice único de domínio não está presente",
    indexes.length === 0,
    indexes.map((row) => row.indexname).join(",") || "ausente",
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passaram`);
  await systemPrisma.$disconnect();
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
