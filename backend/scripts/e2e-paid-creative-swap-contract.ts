/**
 * Contrato MVP Creative A/B Copilot (sem secrets / sem BD).
 *
 *   cd backend && npx tsx scripts/e2e-paid-creative-swap-contract.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

function main() {
  const root = join(process.cwd(), "src");
  const fe = join(process.cwd(), "../frontend/src");

  const svc = readFileSync(join(root, "paid/creativeSwap.service.ts"), "utf8");
  const ranking = readFileSync(join(root, "paid/creativeRanking.ts"), "utf8");
  const metaM = readFileSync(join(root, "paid/optimizer/meta-metrics.ts"), "utf8");
  const googleM = readFileSync(join(root, "paid/optimizer/google-metrics.ts"), "utf8");
  const routes = readFileSync(join(root, "routes/paid.routes.ts"), "utf8");
  const actions = readFileSync(join(root, "paid/optimizer/actions.service.ts"), "utf8");
  const alerts = readFileSync(join(root, "paid/optimizer/alerts.service.ts"), "utf8");
  const opt = readFileSync(join(root, "paid/optimizer/optimizer.service.ts"), "utf8");
  const ui = readFileSync(join(fe, "pages/dpilot/DpilotCreativeSwapActions.tsx"), "utf8");
  const pages = readFileSync(join(fe, "pages/dpilot/DpilotPaidPages.tsx"), "utf8");
  const adsSvc = readFileSync(join(fe, "services/paidAdsService.ts"), "utf8");
  const apply = readFileSync(join(root, "paid/change-request-apply.ts"), "utf8");

  record(
    "flag_creative_swap grava optimizer_flags",
    actions.includes("creative_swap_recommended_at") && actions.includes("flagCreativeSwap"),
    "ok",
  );
  record(
    "serviço resolve Meta publish + Google publish_rsa + clear flag",
    svc.includes("meta_publish_creative") &&
      svc.includes("publish_rsa") &&
      svc.includes("clearCreativeSwapFlag") &&
      svc.includes("applyCreativeSwap") &&
      svc.includes("source: \"creative_swap_copilot\""),
    "ok",
  );
  record(
    "rotas creative-swap preview/apply/dismiss/message-recs",
    routes.includes("creative-swap/apply") &&
      routes.includes("creative-swap/dismiss") &&
      routes.includes("creative-swap/message-recs") &&
      routes.includes("previewCampaignCreativeSwap") &&
      routes.includes("recommendCampaignMessageOffer"),
    "ok",
  );
  record(
    "change-request-apply cobre meta_publish_creative + publish_rsa",
    apply.includes('case "meta_publish_creative"') && apply.includes('case "publish_rsa"'),
    "ok",
  );
  record(
    "alerta creative_swap_flagged no tick",
    alerts.includes("creative_swap_flagged") &&
      alerts.includes("enqueueCreativeSwapFlaggedAlert") &&
      opt.includes("enqueueCreativeSwapFlaggedAlert"),
    "ok",
  );
  record(
    "UI CTA alinhada ao preview (publish só com next_action; recs Meta/Google)",
    ui.includes("Publicar variante") &&
      ui.includes("Tratado") &&
      ui.includes("applyCreativeSwap") &&
      ui.includes("canPublish") &&
      ui.includes("supportsMessageRecs") &&
      ui.includes("loadPreview") &&
      ui.includes("meta_ads") &&
      ui.includes("google_ads") &&
      pages.includes("DpilotCreativeSwapActions") &&
      adsSvc.includes("creative-swap/apply") &&
      adsSvc.includes("ai_run_id"),
    "ok",
  );
  record(
    "ranking por anúncio Meta/Google no preview",
    ranking.includes("rankCreativeVariants") &&
      metaM.includes("fetchMetaAdInsights") &&
      googleM.includes("fetchGoogleAdGroupAdMetrics") &&
      svc.includes("rankPublishedCreatives") &&
      svc.includes("ranking_source") &&
      adsSvc.includes("ranking_source") &&
      ui.includes("previewCreativeSwap") &&
      ui.includes("vencedor"),
    "ok",
  );

  const msgRecs = readFileSync(join(root, "paid/messageOfferRecs.ts"), "utf8");
  const msgSvc = readFileSync(join(root, "paid/messageOfferRecs.service.ts"), "utf8");
  record(
    "message/offer recs sem inventar funil + rota + UI",
    msgRecs.includes("MESSAGE_OFFER_RECS_SYSTEM") &&
      msgRecs.includes("Do NOT invent") &&
      msgSvc.includes("buildDeterministicMessageVariants") &&
      msgSvc.includes("persistVariants") &&
      msgSvc.includes('feature: "rsa_generation"') &&
      msgSvc.includes("paidAdsAiRun") &&
      routes.includes("creative-swap/message-recs") &&
      adsSvc.includes("message-recs") &&
      ui.includes("Sugerir mensagens") &&
      ui.includes("recommendMessageOffer"),
    "ok",
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passaram`);
  if (failed.length) process.exitCode = 1;
}

main();
