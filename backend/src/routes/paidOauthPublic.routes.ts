import { Router, type Request, type Response, type NextFunction } from "express";
import { oauthController } from "../paid/oauth.controller";

/**
 * Callbacks OAuth (redirect do Google / Meta / TikTok) — **sem** JWT; validação por `state` na BD.
 */
const paidOauthPublicRouter = Router();

function asyncRoute(
  fn: (req: Request, res: Response) => Promise<unknown> | unknown,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

paidOauthPublicRouter.get(
  "/oauth/google/callback",
  asyncRoute((req, res) => oauthController.googleCallback(req, res)),
);
paidOauthPublicRouter.get(
  "/oauth/meta/callback",
  asyncRoute((req, res) => oauthController.metaCallback(req, res)),
);
paidOauthPublicRouter.get(
  "/oauth/tiktok/callback",
  asyncRoute((req, res) => oauthController.tiktokCallback(req, res)),
);

export { paidOauthPublicRouter };
