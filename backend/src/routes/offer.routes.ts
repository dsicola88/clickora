import { Router } from "express";
import { offerController } from "../controllers/offer.controller";
import { authenticateJwtOrApiKey } from "../middleware/authenticateJwtOrApiKey";
import { enforceApiKeyHttpScope } from "../middleware/requireApiKeyScope";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";

export const offerRouter = Router();

offerRouter.use(
  authenticateJwtOrApiKey,
  enforceApiKeyHttpScope,
  tenantIsolation,
  requireActiveSubscription,
);

offerRouter.get("/", offerController.list);
offerRouter.post("/backfill", offerController.backfill);
offerRouter.get("/:id", offerController.getById);
offerRouter.post("/", offerController.create);
offerRouter.patch("/:id", offerController.update);
offerRouter.delete("/:id", offerController.remove);
offerRouter.post("/:id/validate", offerController.validate);
offerRouter.put("/:id/domains", offerController.putDomains);
offerRouter.get("/:id/events", offerController.events);
