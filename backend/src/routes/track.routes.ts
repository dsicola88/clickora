import express, { Router } from "express";
import { trackController } from "../controllers/track.controller";
import { authenticate } from "../middleware/authenticate";
import { tenantIsolation } from "../middleware/tenantIsolation";

export const trackRouter = Router();

// Track routes are public (called from presell pages)
trackRouter.get("/r/:presellId", trackController.redirect);
trackRouter.get("/pixel/:presellId.gif", trackController.pixel);
trackRouter.get("/v2/clickora.min.js", trackController.serveClickoraEmbed);
trackRouter.post(
  "/conversions/csv",
  express.text({ limit: "5mb", type: ["text/csv", "application/csv", "text/plain", "*/*"] }),
  trackController.conversionsCsv,
);
trackRouter.post("/click", trackController.trackClick);
trackRouter.post("/impression", trackController.trackImpression);
trackRouter.post("/event", trackController.trackEvent);
trackRouter.post("/postback/google-ads", trackController.postbackGoogleAds);
trackRouter.post("/postback/microsoft-ads", trackController.postbackMicrosoftAds);
trackRouter.get("/postbacks/templates", authenticate, tenantIsolation, trackController.getPostbackTemplates);
trackRouter.get("/postbacks/audit", authenticate, tenantIsolation, trackController.getPostbackAudit);
trackRouter.get("/gclid/:gclid", authenticate, tenantIsolation, trackController.lookupGclid);
