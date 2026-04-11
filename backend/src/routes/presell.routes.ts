import { Router } from "express";
import { presellController } from "../controllers/presell.controller";
import { authenticate } from "../middleware/authenticate";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";

export const presellRouter = Router();

presellRouter.use(authenticate, tenantIsolation, requireActiveSubscription);

presellRouter.get("/", presellController.getAll);
presellRouter.get("/count", presellController.getCount);
presellRouter.post("/import-from-url", presellController.importFromUrl);
presellRouter.get("/:id", presellController.getById);
presellRouter.post("/", presellController.create);
presellRouter.put("/:id", presellController.update);
presellRouter.delete("/:id", presellController.delete);
presellRouter.post("/:id/duplicate", presellController.duplicate);
presellRouter.patch("/:id/status", presellController.toggleStatus);
