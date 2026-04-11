import { Router, Request, Response, NextFunction } from "express";
import { adminController } from "../controllers/admin.controller";
import { brandingController } from "../controllers/branding.controller";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { faviconUpload } from "../lib/brandingUpload";
import { plansLandingController } from "../controllers/plansLanding.controller";
import { plansHeroUpload } from "../lib/plansLandingUpload";

export const adminRouter = Router();

adminRouter.use(authenticate);

function handleFaviconUpload(req: Request, res: Response, next: NextFunction) {
  faviconUpload.single("favicon")(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Erro no upload";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}

adminRouter.post(
  "/branding/favicon",
  requireRole("super_admin"),
  handleFaviconUpload,
  brandingController.uploadFavicon,
);
adminRouter.delete("/branding/favicon", requireRole("super_admin"), brandingController.clearFavicon);

function handlePlansHeroUpload(req: Request, res: Response, next: NextFunction) {
  plansHeroUpload.single("hero_image")(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Erro no upload";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}

adminRouter.get("/plans-landing", requireRole("super_admin"), plansLandingController.getAdmin);
adminRouter.patch("/plans-landing", requireRole("super_admin"), plansLandingController.patchAdmin);
adminRouter.post(
  "/plans-landing/hero-image",
  requireRole("super_admin"),
  handlePlansHeroUpload,
  plansLandingController.uploadHero,
);
adminRouter.delete("/plans-landing/hero-image", requireRole("super_admin"), plansLandingController.clearHero);

adminRouter.use(requireRole("super_admin", "admin"));

adminRouter.get("/users", adminController.getAllUsers);
adminRouter.get("/plans", adminController.getPlans);
adminRouter.get("/overview", adminController.getOverview);
adminRouter.post("/users/:userId/suspend", adminController.suspendUser);
adminRouter.post("/users/:userId/reactivate", adminController.reactivateUser);
adminRouter.get("/metrics", adminController.getMetrics);
adminRouter.patch("/users/:userId/subscription", adminController.updateUserSubscription);
adminRouter.post("/users/:userId/password", adminController.setUserPassword);
adminRouter.patch("/users/:userId/plan", adminController.updateUserPlan);

adminRouter.patch("/plans/:planId", requireRole("super_admin"), adminController.updatePlan);
