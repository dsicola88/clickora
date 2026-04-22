import { Router } from "express";
import { analyticsController } from "../controllers/analytics.controller";
import { authenticate } from "../middleware/authenticate";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";

export const analyticsRouter = Router();

analyticsRouter.use(authenticate, tenantIsolation, requireActiveSubscription);

analyticsRouter.get("/", analyticsController.getSummary);
analyticsRouter.get("/events", analyticsController.getEvents);
analyticsRouter.get("/conversions", analyticsController.listConversions);
analyticsRouter.get("/dashboard", analyticsController.getDashboard);
analyticsRouter.get("/google-ads-insights", analyticsController.getGoogleAdsInsights);
analyticsRouter.get("/google-ads-offline-import.csv", analyticsController.getGoogleAdsOfflineImportCsv);
analyticsRouter.get("/blacklist-blocks", analyticsController.getBlacklistBlocks);
