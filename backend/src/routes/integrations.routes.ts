import { Router } from "express";
import { integrationsController } from "../controllers/integrations.controller";
import { authenticate } from "../middleware/authenticate";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";

export const integrationsRouter = Router();

integrationsRouter.get("/affiliate-webhook", integrationsController.affiliateWebhook);
integrationsRouter.post("/affiliate-webhook", integrationsController.affiliateWebhook);

const authed = Router();
authed.use(authenticate, tenantIsolation, requireActiveSubscription);
authed.get("/affiliate-webhook-info", integrationsController.getAffiliateWebhookInfo);
authed.get("/google-ads", integrationsController.getGoogleAdsSettings);
authed.patch("/google-ads", integrationsController.patchGoogleAdsSettings);
authed.post("/test-sale-email", integrationsController.testSaleNotificationEmail);
authed.patch("/notification-email", integrationsController.patchNotificationEmail);
authed.get("/telegram", integrationsController.getTelegramSettings);
authed.patch("/telegram", integrationsController.patchTelegramSettings);
authed.post("/telegram/test", integrationsController.testTelegramIntegration);
authed.get("/push", integrationsController.getWebPushConfig);
authed.post("/push/subscribe", integrationsController.subscribeWebPush);
authed.post("/push/unsubscribe", integrationsController.unsubscribeWebPush);
authed.post("/push/test", integrationsController.testWebPush);
authed.get("/blacklist", integrationsController.listBlacklist);
authed.post("/blacklist", integrationsController.addBlacklist);
authed.delete("/blacklist/:id", integrationsController.removeBlacklist);
authed.get("/whitelist", integrationsController.listWhitelist);
authed.post("/whitelist", integrationsController.addWhitelist);
authed.delete("/whitelist/:id", integrationsController.removeWhitelist);
authed.get("/tracking-guards", integrationsController.getTrackingGuards);
authed.patch("/tracking-guards", integrationsController.patchTrackingGuards);

integrationsRouter.use(authed);
