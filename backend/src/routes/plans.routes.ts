import { Router } from "express";
import { plansController } from "../controllers/plans.controller";
import { authenticate } from "../middleware/authenticate";
import { tenantIsolation } from "../middleware/tenantIsolation";

export const plansRouter = Router();

plansRouter.get("/", plansController.getAll);
plansRouter.post("/subscribe", authenticate, tenantIsolation, plansController.subscribe);
plansRouter.post("/cancel", authenticate, tenantIsolation, plansController.cancel);
