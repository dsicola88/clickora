import { Router, type Request, type Response, type NextFunction } from "express";
import { authenticate } from "../middleware/authenticate";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";
import { paidMetaAssetUpload } from "../lib/paidMetaAssetUpload";
import { paidTiktokAssetUpload } from "../lib/paidTiktokAssetUpload";
import { oauthController } from "../paid/oauth.controller";
import { paidController } from "../paid/paid.controller";
import { requireDpilotPlan } from "../paid/requireDpilotPlan";

const paidRouter = Router();
/** Assinatura activa + flag de plano de anúncios (antes só havia requireDpilotPlan). */
paidRouter.use(authenticate, requireActiveSubscription, requireDpilotPlan);

/** Encaminha rejeições async para o errorHandler (evita `void` + unhandledRejection). */
function asyncRoute(
  fn: (req: Request, res: Response) => Promise<unknown> | unknown,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

function handleMetaAssetUpload(req: Request, res: Response, next: NextFunction) {
  paidMetaAssetUpload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Erro no upload";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}

function handleTiktokAssetUpload(req: Request, res: Response, next: NextFunction) {
  paidTiktokAssetUpload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Erro no upload";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}

paidRouter.get("/oauth/config", asyncRoute((req, res) => oauthController.oauthConfig(req, res)));
paidRouter.post("/oauth/google/start", asyncRoute((req, res) => oauthController.googleStart(req, res)));
paidRouter.post(
  "/oauth/google/from-integrations",
  asyncRoute((req, res) => oauthController.googleFromIntegrations(req, res)),
);
paidRouter.post("/oauth/meta/start", asyncRoute((req, res) => oauthController.metaStart(req, res)));
paidRouter.post("/oauth/tiktok/start", asyncRoute((req, res) => oauthController.tiktokStart(req, res)));
paidRouter.post("/oauth/google/disconnect", asyncRoute((req, res) => oauthController.disconnectGoogle(req, res)));
paidRouter.post("/oauth/meta/disconnect", asyncRoute((req, res) => oauthController.disconnectMeta(req, res)));
paidRouter.post("/oauth/tiktok/disconnect", asyncRoute((req, res) => oauthController.disconnectTiktok(req, res)));

paidRouter.get("/projects", asyncRoute((req, res) => paidController.listProjects(req, res)));
paidRouter.get("/projects/:projectId", asyncRoute((req, res) => paidController.getProject(req, res)));
paidRouter.get("/projects/:projectId/overview", asyncRoute((req, res) => paidController.getOverview(req, res)));
paidRouter.get("/projects/:projectId/campaigns", asyncRoute((req, res) => paidController.listCampaigns(req, res)));
paidRouter.patch(
  "/projects/:projectId/campaigns/:campaignId/optimizer-limits",
  asyncRoute((req, res) => paidController.patchCampaignOptimizerLimits(req, res)),
);
paidRouter.get(
  "/projects/:projectId/campaigns/:campaignId/creative-swap",
  asyncRoute((req, res) => paidController.previewCampaignCreativeSwap(req, res)),
);
paidRouter.post(
  "/projects/:projectId/campaigns/:campaignId/creative-swap/apply",
  asyncRoute((req, res) => paidController.applyCampaignCreativeSwap(req, res)),
);
paidRouter.post(
  "/projects/:projectId/campaigns/:campaignId/creative-swap/dismiss",
  asyncRoute((req, res) => paidController.dismissCampaignCreativeSwap(req, res)),
);
paidRouter.post(
  "/projects/:projectId/campaigns/:campaignId/creative-swap/message-recs",
  asyncRoute((req, res) => paidController.recommendCampaignMessageOffer(req, res)),
);
paidRouter.get(
  "/projects/:projectId/campaigns/:campaignId/google-performance",
  asyncRoute((req, res) => paidController.googleCampaignPerformance(req, res)),
);
paidRouter.get(
  "/projects/:projectId/campaigns/:campaignId/google-studio",
  asyncRoute((req, res) => paidController.getGoogleCampaignStudio(req, res)),
);
paidRouter.patch(
  "/projects/:projectId/campaigns/:campaignId/google-draft",
  asyncRoute((req, res) => paidController.patchGoogleCampaignDraft(req, res)),
);
paidRouter.post(
  "/projects/:projectId/campaigns/:campaignId/google-studio-actions",
  asyncRoute((req, res) => paidController.postGoogleCampaignStudioActions(req, res)),
);
paidRouter.post(
  "/projects/:projectId/campaigns/:campaignId/meta-studio-actions",
  asyncRoute((req, res) => paidController.postMetaCampaignStudioActions(req, res)),
);
paidRouter.post(
  "/projects/:projectId/campaigns/:campaignId/tiktok-studio-actions",
  asyncRoute((req, res) => paidController.postTiktokCampaignStudioActions(req, res)),
);
paidRouter.post(
  "/projects/:projectId/campaigns/:campaignId/snap-daily-budget-to-guardrail",
  asyncRoute((req, res) => paidController.snapCampaignDailyBudgetToGuardrailCeiling(req, res)),
);
paidRouter.post(
  "/projects/:projectId/campaigns/:campaignId/snap-geo-to-guardrail",
  asyncRoute((req, res) => paidController.snapCampaignGeoTargetsToGuardrailAllowed(req, res)),
);
paidRouter.post(
  "/projects/:projectId/campaigns/:campaignId/archive",
  asyncRoute((req, res) => paidController.archiveCampaign(req, res)),
);
paidRouter.delete(
  "/projects/:projectId/campaigns/:campaignId",
  asyncRoute((req, res) => paidController.deleteArchivedCampaign(req, res)),
);
paidRouter.get(
  "/projects/:projectId/optimizer-decisions",
  asyncRoute((req, res) => paidController.listOptimizerDecisions(req, res)),
);
paidRouter.get(
  "/projects/:projectId/health-summary",
  asyncRoute((req, res) => paidController.getProjectHealthSummary(req, res)),
);
paidRouter.get(
  "/projects/:projectId/networks-readiness",
  asyncRoute((req, res) => paidController.networksReadiness(req, res)),
);
paidRouter.get(
  "/projects/:projectId/change-requests",
  asyncRoute((req, res) => paidController.listChangeRequests(req, res)),
);
paidRouter.post("/change-requests/review", asyncRoute((req, res) => paidController.reviewChangeRequest(req, res)));
paidRouter.delete("/change-requests/:id", asyncRoute((req, res) => paidController.deleteChangeRequest(req, res)));
paidRouter.get(
  "/projects/:projectId/meta-connection",
  asyncRoute((req, res) => paidController.getMetaConnection(req, res)),
);
paidRouter.get(
  "/projects/:projectId/meta-pages",
  asyncRoute((req, res) => paidController.listMetaPages(req, res)),
);
paidRouter.post(
  "/projects/:projectId/meta-page",
  asyncRoute((req, res) => paidController.selectMetaPage(req, res)),
);
paidRouter.get(
  "/projects/:projectId/tiktok-connection",
  asyncRoute((req, res) => paidController.getTikTokConnection(req, res)),
);
paidRouter.get(
  "/projects/:projectId/meta-overview",
  asyncRoute((req, res) => paidController.getMetaOverviewCounts(req, res)),
);
paidRouter.get(
  "/projects/:projectId/tiktok-overview",
  asyncRoute((req, res) => paidController.getTikTokOverviewCounts(req, res)),
);
paidRouter.post(
  "/projects/:projectId/paid-mode",
  asyncRoute((req, res) => paidController.updateProjectPaidMode(req, res)),
);
paidRouter.post("/guardrails", asyncRoute((req, res) => paidController.upsertGuardrails(req, res)));
paidRouter.get("/projects/:projectId/ai-runs", asyncRoute((req, res) => paidController.listAiRuns(req, res)));
paidRouter.post(
  "/projects/:projectId/reconcile-campaigns",
  asyncRoute((req, res) => paidController.reconcileCampaigns(req, res)),
);
/** Gestor Google Ads — overview, métricas, inventário, recomendações, IA, duplicação */
paidRouter.get(
  "/projects/:projectId/google-ads/overview",
  asyncRoute((req, res) => paidController.googleAdsManagerOverview(req, res)),
);
paidRouter.get(
  "/projects/:projectId/google-ads/final-url-audit",
  asyncRoute((req, res) => paidController.googleAdsFinalUrlAudit(req, res)),
);
/** POST repara; GET/barra final devolvem 405 claro (evita toast opaco «Erro 404»). */
function finalUrlRepairMethodGuard(req: Request, res: Response, next: NextFunction) {
  if (req.method === "POST") return next();
  return res.status(405).json({
    error: "Use POST para reparar Final URLs (o botão «Reparar Final URLs» na página Campanhas).",
    code: "method_not_allowed",
  });
}
paidRouter.all(
  "/projects/:projectId/google-ads/final-url-repair",
  finalUrlRepairMethodGuard,
  asyncRoute((req, res) => paidController.googleAdsFinalUrlRepair(req, res)),
);
paidRouter.all(
  "/projects/:projectId/google-ads/final-url-repair/",
  finalUrlRepairMethodGuard,
  asyncRoute((req, res) => paidController.googleAdsFinalUrlRepair(req, res)),
);
paidRouter.get(
  "/projects/:projectId/google-ads/campaigns-metrics",
  asyncRoute((req, res) => paidController.googleAdsManagerCampaignsMetrics(req, res)),
);
paidRouter.get(
  "/projects/:projectId/google-ads/inventory",
  asyncRoute((req, res) => paidController.googleAdsManagerInventory(req, res)),
);
paidRouter.get(
  "/projects/:projectId/google-ads/recommendations",
  asyncRoute((req, res) => paidController.googleAdsManagerRecommendations(req, res)),
);
paidRouter.post(
  "/projects/:projectId/google-ads/recommendations/action",
  asyncRoute((req, res) => paidController.googleAdsRecommendationAction(req, res)),
);
paidRouter.get(
  "/projects/:projectId/google-ads/device-performance",
  asyncRoute((req, res) => paidController.googleAdsDevicePerformance(req, res)),
);
paidRouter.post(
  "/projects/:projectId/google-ads/ai-insights",
  asyncRoute((req, res) => paidController.googleAdsManagerAiInsights(req, res)),
);
paidRouter.post(
  "/projects/:projectId/campaigns/:campaignId/duplicate-google",
  asyncRoute((req, res) => paidController.duplicateGoogleCampaign(req, res)),
);
paidRouter.get(
  "/projects/:projectId/google-ads/search-terms",
  asyncRoute((req, res) => paidController.googleAdsProjectSearchTerms(req, res)),
);
paidRouter.post(
  "/projects/:projectId/google-ads/search-terms/negate-batch",
  asyncRoute((req, res) => paidController.googleAdsProjectSearchTermsNegateBatch(req, res)),
);
paidRouter.get(
  "/projects/:projectId/campaigns/:campaignId/google-ads/search-terms",
  asyncRoute((req, res) => paidController.googleAdsSearchTerms(req, res)),
);
paidRouter.post(
  "/projects/:projectId/campaigns/:campaignId/google-ads/search-terms/negate",
  asyncRoute((req, res) => paidController.googleAdsAppendSearchTermNegatives(req, res)),
);
paidRouter.get(
  "/projects/:projectId/google-ads/keyword-metrics",
  asyncRoute((req, res) => paidController.googleAdsKeywordMetrics(req, res)),
);
paidRouter.get(
  "/projects/:projectId/google-ads/remote-campaigns",
  asyncRoute((req, res) => paidController.googleAdsListRemoteCampaigns(req, res)),
);
paidRouter.post(
  "/projects/:projectId/google-ads/import-campaigns",
  asyncRoute((req, res) => paidController.googleAdsImportCampaigns(req, res)),
);
/** Gestor Meta Ads — overview, métricas, import (sem Search Terms / RSA) */
paidRouter.get(
  "/projects/:projectId/meta-ads/overview",
  asyncRoute((req, res) => paidController.metaAdsManagerOverview(req, res)),
);
paidRouter.get(
  "/projects/:projectId/meta-ads/campaigns-metrics",
  asyncRoute((req, res) => paidController.metaAdsManagerCampaignsMetrics(req, res)),
);
paidRouter.get(
  "/projects/:projectId/meta-ads/inventory",
  asyncRoute((req, res) => paidController.metaAdsManagerInventory(req, res)),
);
paidRouter.get(
  "/projects/:projectId/meta-ads/remote-campaigns",
  asyncRoute((req, res) => paidController.metaAdsListRemoteCampaigns(req, res)),
);
paidRouter.post(
  "/projects/:projectId/meta-ads/import-campaigns",
  asyncRoute((req, res) => paidController.metaAdsImportCampaigns(req, res)),
);
/** Gestor TikTok Ads */
paidRouter.get(
  "/projects/:projectId/tiktok-ads/overview",
  asyncRoute((req, res) => paidController.tiktokAdsManagerOverview(req, res)),
);
paidRouter.get(
  "/projects/:projectId/tiktok-ads/campaigns-metrics",
  asyncRoute((req, res) => paidController.tiktokAdsManagerCampaignsMetrics(req, res)),
);
paidRouter.get(
  "/projects/:projectId/tiktok-ads/inventory",
  asyncRoute((req, res) => paidController.tiktokAdsManagerInventory(req, res)),
);
paidRouter.get(
  "/projects/:projectId/tiktok-ads/remote-campaigns",
  asyncRoute((req, res) => paidController.tiktokAdsListRemoteCampaigns(req, res)),
);
paidRouter.post(
  "/projects/:projectId/tiktok-ads/import-campaigns",
  asyncRoute((req, res) => paidController.tiktokAdsImportCampaigns(req, res)),
);
paidRouter.get(
  "/projects/:projectId/google-ads/rsa-policy-audit",
  asyncRoute((req, res) => paidController.googleAdsRsaPolicyAudit(req, res)),
);
paidRouter.get(
  "/projects/:projectId/campaigns/:campaignId/google-ads/rsa-policy",
  asyncRoute((req, res) => paidController.googleAdsRsaPolicy(req, res)),
);
paidRouter.post(
  "/projects/:projectId/meta-campaign-plan",
  asyncRoute((req, res) => paidController.metaCampaignPlan(req, res)),
);
paidRouter.post(
  "/projects/:projectId/google-campaign-plan",
  asyncRoute((req, res) => paidController.googleCampaignPlan(req, res)),
);
paidRouter.post(
  "/projects/:projectId/google-landing-extract",
  asyncRoute((req, res) => paidController.googleLandingExtract(req, res)),
);
paidRouter.post(
  "/projects/:projectId/google-keyword-insight",
  asyncRoute((req, res) => paidController.googleKeywordInsight(req, res)),
);
paidRouter.post(
  "/projects/:projectId/google-keyword-suggest",
  asyncRoute((req, res) => paidController.googleKeywordSuggest(req, res)),
);
paidRouter.post(
  "/projects/:projectId/tiktok-campaign-plan",
  asyncRoute((req, res) => paidController.tiktokCampaignPlan(req, res)),
);
paidRouter.post(
  "/projects/:projectId/meta-assets",
  handleMetaAssetUpload,
  asyncRoute((req, res) => paidController.uploadMetaAsset(req, res)),
);
paidRouter.post(
  "/projects/:projectId/tiktok-assets",
  handleTiktokAssetUpload,
  asyncRoute((req, res) => paidController.uploadTiktokAsset(req, res)),
);

export { paidRouter };
