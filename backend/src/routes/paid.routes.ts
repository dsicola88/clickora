import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { oauthController } from "../paid/oauth.controller";
import { paidController } from "../paid/paid.controller";
import { requireDpilotPlan } from "../paid/requireDpilotPlan";

const paidRouter = Router();
paidRouter.use(authenticate, requireDpilotPlan);

paidRouter.get("/oauth/config", (req, res) => void oauthController.oauthConfig(req, res));
paidRouter.post("/oauth/google/start", (req, res) => void oauthController.googleStart(req, res));
paidRouter.post("/oauth/meta/start", (req, res) => void oauthController.metaStart(req, res));
paidRouter.post("/oauth/tiktok/start", (req, res) => void oauthController.tiktokStart(req, res));
paidRouter.post("/oauth/google/disconnect", (req, res) => void oauthController.disconnectGoogle(req, res));
paidRouter.post("/oauth/meta/disconnect", (req, res) => void oauthController.disconnectMeta(req, res));
paidRouter.post("/oauth/tiktok/disconnect", (req, res) => void oauthController.disconnectTiktok(req, res));

paidRouter.get("/projects", (req, res) => void paidController.listProjects(req, res));
paidRouter.get("/projects/:projectId", (req, res) => void paidController.getProject(req, res));
paidRouter.get("/projects/:projectId/overview", (req, res) => void paidController.getOverview(req, res));
paidRouter.get("/projects/:projectId/campaigns", (req, res) => void paidController.listCampaigns(req, res));
paidRouter.get("/projects/:projectId/change-requests", (req, res) =>
  void paidController.listChangeRequests(req, res),
);
paidRouter.post("/change-requests/review", (req, res) => void paidController.reviewChangeRequest(req, res));
paidRouter.get("/projects/:projectId/meta-connection", (req, res) =>
  void paidController.getMetaConnection(req, res),
);
paidRouter.get("/projects/:projectId/tiktok-connection", (req, res) =>
  void paidController.getTikTokConnection(req, res),
);
paidRouter.get("/projects/:projectId/meta-overview", (req, res) =>
  void paidController.getMetaOverviewCounts(req, res),
);
paidRouter.get("/projects/:projectId/tiktok-overview", (req, res) =>
  void paidController.getTikTokOverviewCounts(req, res),
);
paidRouter.post("/projects/:projectId/paid-mode", (req, res) =>
  void paidController.updateProjectPaidMode(req, res),
);
paidRouter.post("/guardrails", (req, res) => void paidController.upsertGuardrails(req, res));
paidRouter.get("/projects/:projectId/ai-runs", (req, res) => void paidController.listAiRuns(req, res));

export { paidRouter };
