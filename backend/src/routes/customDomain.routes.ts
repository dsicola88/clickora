import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { customDomainController } from "../controllers/customDomain.controller";

export const customDomainRouter = Router();

customDomainRouter.use(authenticate, tenantIsolation);

customDomainRouter.get("/", customDomainController.list);
customDomainRouter.get("/quota", customDomainController.quota);
customDomainRouter.post("/", customDomainController.create);
customDomainRouter.post("/:id/verify", customDomainController.verify);
customDomainRouter.patch("/:id/default", customDomainController.setDefault);
customDomainRouter.patch("/:id/root-presell", customDomainController.setRootPresell);
customDomainRouter.delete("/:id", customDomainController.remove);
