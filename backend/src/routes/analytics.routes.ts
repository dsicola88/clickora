import { Router } from "express";
import { analyticsController } from "../controllers/analytics.controller";
import { authenticateJwtOrApiKey } from "../middleware/authenticateJwtOrApiKey";
import { enforceApiKeyHttpScope } from "../middleware/requireApiKeyScope";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";

export const analyticsRouter = Router();

analyticsRouter.use(
  authenticateJwtOrApiKey,
  enforceApiKeyHttpScope,
  tenantIsolation,
  requireActiveSubscription,
);

analyticsRouter.get("/", analyticsController.getSummary);
analyticsRouter.get("/tracking-click/:eventId", analyticsController.getTrackingClick);
analyticsRouter.get("/events", analyticsController.getEvents);
analyticsRouter.get("/conversions", analyticsController.listConversions);
analyticsRouter.get("/dashboard", analyticsController.getDashboard);
analyticsRouter.get("/funnel", analyticsController.getFunnel);
analyticsRouter.get("/google-ads-insights", analyticsController.getGoogleAdsInsights);
analyticsRouter.get("/google-ads-offline-import.csv", analyticsController.getGoogleAdsOfflineImportCsv);
analyticsRouter.get("/blacklist-blocks", analyticsController.getBlacklistBlocks);
