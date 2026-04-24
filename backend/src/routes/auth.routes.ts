import { Router, Request, Response, NextFunction } from "express";
import { authController } from "../controllers/auth.controller";
import { authenticate } from "../middleware/authenticate";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { avatarUpload } from "../lib/avatarUpload";
import { authCredentialLimiter } from "../middleware/rateLimiters";

export const authRouter = Router();

function handleAvatarUpload(req: Request, res: Response, next: NextFunction) {
  avatarUpload.single("avatar")(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Erro no upload";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}

authRouter.post("/login", authCredentialLimiter, authController.login);
authRouter.post("/google", authCredentialLimiter, authController.googleLogin);
authRouter.post("/register", authCredentialLimiter, authController.register);
authRouter.post("/logout", authController.logout);
authRouter.get("/me", authenticate, tenantIsolation, authController.me);
authRouter.patch("/me", authenticate, tenantIsolation, authController.patchProfile);
authRouter.get("/me/data-export", authenticate, tenantIsolation, authController.exportMyData);
authRouter.post("/me/delete-account", authenticate, tenantIsolation, authController.deleteAccount);
authRouter.post("/change-password", authenticate, authController.changePassword);
authRouter.post("/avatar", authenticate, tenantIsolation, handleAvatarUpload, authController.uploadAvatar);
authRouter.delete("/avatar", authenticate, tenantIsolation, authController.deleteAvatar);
authRouter.post("/reset-password", authCredentialLimiter, authController.resetPassword);
authRouter.post("/update-password", authCredentialLimiter, authController.updatePassword);
