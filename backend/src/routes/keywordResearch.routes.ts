import { Router } from "express";
import { keywordResearchController } from "../controllers/keywordResearch.controller";
import { authenticate } from "../middleware/authenticate";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";
import { keywordGenerateLimiter } from "../middleware/rateLimiters";

export const keywordResearchRouter = Router();

keywordResearchRouter.use(authenticate, tenantIsolation, requireActiveSubscription);

keywordResearchRouter.get("/options", keywordResearchController.options);
keywordResearchRouter.get("/", keywordResearchController.list);
keywordResearchRouter.get("/:id", keywordResearchController.getById);
keywordResearchRouter.post("/page-preview", keywordGenerateLimiter, keywordResearchController.previewPage);
keywordResearchRouter.post("/generate", keywordGenerateLimiter, keywordResearchController.generate);
keywordResearchRouter.patch("/:id", keywordResearchController.update);
