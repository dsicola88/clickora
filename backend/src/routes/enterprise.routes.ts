import { Router } from "express";
import { apiKeysController } from "../controllers/apiKeys.controller";
import { tenantBrandingController } from "../controllers/tenantBranding.controller";
import { mfaController } from "../controllers/mfa.controller";
import { onboardingController } from "../controllers/onboarding.controller";
import { authenticateJwtOrApiKey } from "../middleware/authenticateJwtOrApiKey";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";

export const enterpriseRouter = Router();

enterpriseRouter.use(authenticateJwtOrApiKey, tenantIsolation, requireActiveSubscription);

enterpriseRouter.get("/mfa/status", mfaController.status);
enterpriseRouter.post("/mfa/setup", mfaController.setupStart);
enterpriseRouter.post("/mfa/confirm", mfaController.setupConfirm);
enterpriseRouter.post("/mfa/disable", mfaController.disable);

enterpriseRouter.get("/api-keys", apiKeysController.list);
enterpriseRouter.post("/api-keys", apiKeysController.create);
enterpriseRouter.delete("/api-keys/:id", apiKeysController.revoke);

enterpriseRouter.get("/branding/tenant", tenantBrandingController.getMine);
enterpriseRouter.put("/branding/tenant", tenantBrandingController.upsertMine);

enterpriseRouter.get("/onboarding/status", onboardingController.status);
