import { Router } from "express";
import { trafficRotatorsController } from "../controllers/trafficRotators.controller";
import { authenticateJwtOrApiKey } from "../middleware/authenticateJwtOrApiKey";
import { enforceApiKeyHttpScope } from "../middleware/requireApiKeyScope";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";

export const trafficRotatorsRouter = Router();

trafficRotatorsRouter.use(
  authenticateJwtOrApiKey,
  enforceApiKeyHttpScope,
  tenantIsolation,
  requireActiveSubscription,
);

trafficRotatorsRouter.get("/", trafficRotatorsController.list);
trafficRotatorsRouter.get("/:id/ab-stats", trafficRotatorsController.abStats);
trafficRotatorsRouter.post("/:id/promote-winner", trafficRotatorsController.promoteWinner);
trafficRotatorsRouter.get("/:id", trafficRotatorsController.getOne);
trafficRotatorsRouter.post("/", trafficRotatorsController.create);
trafficRotatorsRouter.patch("/:id", trafficRotatorsController.update);
trafficRotatorsRouter.delete("/:id", trafficRotatorsController.remove);
