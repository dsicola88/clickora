import { Router } from "express";
import { campaignsController } from "../controllers/campaigns.controller";
import { authenticate } from "../middleware/authenticate";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";

export const campaignsRouter = Router();

campaignsRouter.use(authenticate, tenantIsolation, requireActiveSubscription);

campaignsRouter.get("/", campaignsController.list);
campaignsRouter.get("/:id", campaignsController.getById);
campaignsRouter.post("/", campaignsController.create);
campaignsRouter.patch("/:id", campaignsController.update);
campaignsRouter.delete("/:id", campaignsController.remove);
