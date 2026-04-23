import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";
import { workspaceController } from "../controllers/workspace.controller";

export const workspaceRouter = Router();

workspaceRouter.use(authenticate, tenantIsolation, requireActiveSubscription);

workspaceRouter.get("/", workspaceController.listMine);
workspaceRouter.get("/:workspaceId/members", workspaceController.listMembers);
workspaceRouter.patch("/:workspaceId/members/:userId", workspaceController.patchMemberPermissions);
workspaceRouter.get("/:workspaceId/audit", workspaceController.audit);
workspaceRouter.post("/:workspaceId/members", workspaceController.addMember);
workspaceRouter.delete("/:workspaceId/members/:userId", workspaceController.removeMember);
