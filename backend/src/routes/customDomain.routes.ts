import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";
import { customDomainController } from "../controllers/customDomain.controller";

export const customDomainRouter = Router();

customDomainRouter.use(authenticate, tenantIsolation, requireActiveSubscription);

customDomainRouter.get("/", customDomainController.list);
customDomainRouter.get("/quota", customDomainController.quota);
customDomainRouter.get("/routing-events", customDomainController.routingEvents);
customDomainRouter.post("/", customDomainController.create);
customDomainRouter.post("/rollback-primary", customDomainController.rollbackPrimary);
customDomainRouter.get("/:id/go-live", customDomainController.goLive);
customDomainRouter.post("/:id/verify", customDomainController.verify);
customDomainRouter.post("/:id/health-check", customDomainController.healthCheck);
customDomainRouter.post("/:id/promote-primary", customDomainController.promotePrimary);
customDomainRouter.patch("/:id/default", customDomainController.setDefault);
customDomainRouter.patch("/:id/purpose", customDomainController.setPurpose);
customDomainRouter.patch("/:id/default-tracking", customDomainController.setDefaultTracking);
customDomainRouter.patch("/:id/root-presell", customDomainController.setRootPresell);
customDomainRouter.patch("/:id/active", customDomainController.setActive);
customDomainRouter.patch("/:id/routing", customDomainController.setRouting);
customDomainRouter.delete("/:id", customDomainController.remove);
