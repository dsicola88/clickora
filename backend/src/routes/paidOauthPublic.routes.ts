import { Router } from "express";
import { oauthController } from "../paid/oauth.controller";

/**
 * Callbacks OAuth (redirect do Google / Meta / TikTok) — **sem** JWT; validação por `state` na BD.
 */
const paidOauthPublicRouter = Router();
paidOauthPublicRouter.get("/oauth/google/callback", (req, res) => void oauthController.googleCallback(req, res));
paidOauthPublicRouter.get("/oauth/meta/callback", (req, res) => void oauthController.metaCallback(req, res));
paidOauthPublicRouter.get("/oauth/tiktok/callback", (req, res) => void oauthController.tiktokCallback(req, res));

export { paidOauthPublicRouter };
