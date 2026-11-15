import { Router } from "express";
import { demandRadarController } from "../controllers/demandRadar.controller";
import { authenticate } from "../middleware/authenticate";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";
import { keywordGenerateLimiter } from "../middleware/rateLimiters";

export const demandRadarRouter = Router();

demandRadarRouter.use(authenticate, tenantIsolation, requireActiveSubscription);

demandRadarRouter.get("/overview", demandRadarController.overview);
demandRadarRouter.post("/analyze", keywordGenerateLimiter, demandRadarController.analyze);
