import { Router } from "express";
import { apiKeysController } from "../controllers/apiKeys.controller";
import { tenantBrandingController } from "../controllers/tenantBranding.controller";
import { mfaController } from "../controllers/mfa.controller";
import { onboardingController } from "../controllers/onboarding.controller";
import { authenticateJwtOrApiKey } from "../middleware/authenticateJwtOrApiKey";
import {
  enforceApiKeyHttpScope,
  requireApiKeyScope,
  requireSessionJwt,
} from "../middleware/requireApiKeyScope";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";

export const enterpriseRouter = Router();

enterpriseRouter.use(authenticateJwtOrApiKey, tenantIsolation, requireActiveSubscription);

/** MFA e gestão de chaves: só sessão na app. */
enterpriseRouter.get("/mfa/status", requireSessionJwt, mfaController.status);
enterpriseRouter.post("/mfa/setup", requireSessionJwt, mfaController.setupStart);
enterpriseRouter.post("/mfa/confirm", requireSessionJwt, mfaController.setupConfirm);
enterpriseRouter.post("/mfa/disable", requireSessionJwt, mfaController.disable);

enterpriseRouter.get("/api-keys", requireSessionJwt, apiKeysController.list);
enterpriseRouter.post("/api-keys", requireSessionJwt, apiKeysController.create);
enterpriseRouter.delete("/api-keys/:id", requireSessionJwt, apiKeysController.revoke);

enterpriseRouter.get("/branding/tenant", requireApiKeyScope("read"), tenantBrandingController.getMine);
enterpriseRouter.put(
  "/branding/tenant",
  requireApiKeyScope("write"),
  tenantBrandingController.upsertMine,
);

enterpriseRouter.get("/onboarding/status", enforceApiKeyHttpScope, onboardingController.status);
