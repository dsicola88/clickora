import { Router } from "express";
import { campaignsController } from "../controllers/campaigns.controller";
import { authenticateJwtOrApiKey } from "../middleware/authenticateJwtOrApiKey";
import { enforceApiKeyHttpScope } from "../middleware/requireApiKeyScope";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";

export const campaignsRouter = Router();

campaignsRouter.use(
  authenticateJwtOrApiKey,
  enforceApiKeyHttpScope,
  tenantIsolation,
  requireActiveSubscription,
);

campaignsRouter.get("/", campaignsController.list);
campaignsRouter.get("/:id", campaignsController.getById);
campaignsRouter.post("/", campaignsController.create);
campaignsRouter.patch("/:id", campaignsController.update);
campaignsRouter.delete("/:id", campaignsController.remove);
