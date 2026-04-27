import { Router } from "express";
import { integrationsController } from "../controllers/integrations.controller";
import { authenticate } from "../middleware/authenticate";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";
import { requireWorkspaceIntegrationsWrite } from "../middleware/requireWorkspaceIntegrationsWrite";

export const integrationsRouter = Router();

integrationsRouter.get("/affiliate-webhook", integrationsController.affiliateWebhook);
integrationsRouter.post("/affiliate-webhook", integrationsController.affiliateWebhook);
integrationsRouter.get("/google-ads/oauth/callback", integrationsController.googleAdsOAuthCallback);

const authed = Router();
authed.use(authenticate, tenantIsolation, requireActiveSubscription);
authed.get("/affiliate-webhook-info", integrationsController.getAffiliateWebhookInfo);
authed.get("/google-ads", integrationsController.getGoogleAdsSettings);
authed.patch("/google-ads", requireWorkspaceIntegrationsWrite, integrationsController.patchGoogleAdsSettings);
authed.post("/google-ads/oauth/begin", requireWorkspaceIntegrationsWrite, integrationsController.beginGoogleAdsOAuth);
authed.get("/meta-capi", integrationsController.getMetaCapiSettings);
authed.patch("/meta-capi", requireWorkspaceIntegrationsWrite, integrationsController.patchMetaCapiSettings);
authed.get("/tiktok-events", integrationsController.getTiktokEventsSettings);
authed.patch("/tiktok-events", requireWorkspaceIntegrationsWrite, integrationsController.patchTiktokEventsSettings);
authed.post("/test-sale-email", requireWorkspaceIntegrationsWrite, integrationsController.testSaleNotificationEmail);
authed.patch("/notification-email", requireWorkspaceIntegrationsWrite, integrationsController.patchNotificationEmail);
authed.get("/telegram", integrationsController.getTelegramSettings);
authed.patch("/telegram", requireWorkspaceIntegrationsWrite, integrationsController.patchTelegramSettings);
authed.post("/telegram/test", requireWorkspaceIntegrationsWrite, integrationsController.testTelegramIntegration);
authed.get("/push", integrationsController.getWebPushConfig);
authed.post("/push/subscribe", requireWorkspaceIntegrationsWrite, integrationsController.subscribeWebPush);
authed.post("/push/unsubscribe", requireWorkspaceIntegrationsWrite, integrationsController.unsubscribeWebPush);
authed.post("/push/test", requireWorkspaceIntegrationsWrite, integrationsController.testWebPush);
authed.get("/blacklist", integrationsController.listBlacklist);
authed.post("/blacklist", requireWorkspaceIntegrationsWrite, integrationsController.addBlacklist);
authed.delete("/blacklist/:id", requireWorkspaceIntegrationsWrite, integrationsController.removeBlacklist);
authed.get("/whitelist", integrationsController.listWhitelist);
authed.post("/whitelist", requireWorkspaceIntegrationsWrite, integrationsController.addWhitelist);
authed.delete("/whitelist/:id", requireWorkspaceIntegrationsWrite, integrationsController.removeWhitelist);
authed.get("/tracking-guards", integrationsController.getTrackingGuards);
authed.patch("/tracking-guards", requireWorkspaceIntegrationsWrite, integrationsController.patchTrackingGuards);

integrationsRouter.use(authed);
