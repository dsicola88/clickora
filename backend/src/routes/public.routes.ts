import { Router } from "express";
import { presellController } from "../controllers/presell.controller";
import { brandingController } from "../controllers/branding.controller";
import { plansLandingController } from "../controllers/plansLanding.controller";
import { publicAvatarController } from "../controllers/publicAvatar.controller";

export const publicRouter = Router();

publicRouter.get("/presells/id/:id", presellController.getPublicById);
publicRouter.get("/branding", brandingController.getMeta);
publicRouter.get("/branding/favicon", brandingController.getFavicon);
publicRouter.get("/plans-landing", plansLandingController.getPublic);
publicRouter.get("/plans-landing/hero-image", plansLandingController.getHeroImage);
publicRouter.get("/avatar/:userId", publicAvatarController.getByUserId);
