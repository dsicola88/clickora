import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { presellController } from "../controllers/presell.controller";
import { presellComplianceController } from "../controllers/presellCompliance.controller";
import { authenticateJwtOrApiKey } from "../middleware/authenticateJwtOrApiKey";
import { enforceApiKeyHttpScope } from "../middleware/requireApiKeyScope";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";
import { presellBuilderMediaUpload } from "../lib/presellBuilderMediaUpload";
import { complianceAuditLimiter } from "../middleware/rateLimiters";

export const presellRouter = Router();

presellRouter.use(
  authenticateJwtOrApiKey,
  enforceApiKeyHttpScope,
  tenantIsolation,
  requireActiveSubscription,
);

function handleBuilderMediaUpload(req: Request, res: Response, next: NextFunction) {
  presellBuilderMediaUpload.single("image")(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Imagem demasiado grande (máx. 3 MB)." });
      }
      const msg = err instanceof Error ? err.message : "Erro no upload";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}

presellRouter.get("/", presellController.getAll);
presellRouter.get("/count", presellController.getCount);
presellRouter.get("/compliance/rules", presellComplianceController.getRules);
presellRouter.post("/import-from-url", presellController.importFromUrl);
presellRouter.post(
  "/builder-media",
  handleBuilderMediaUpload,
  presellController.uploadBuilderMedia,
);
presellRouter.get("/:id/compliance", presellComplianceController.getLatest);
presellRouter.post(
  "/:id/compliance/audit",
  complianceAuditLimiter,
  presellComplianceController.runAudit,
);
presellRouter.post("/:id/compliance/decisions", presellComplianceController.decide);
presellRouter.get("/:id", presellController.getById);
presellRouter.post("/", presellController.create);
presellRouter.put("/:id", presellController.update);
presellRouter.delete("/:id", presellController.delete);
presellRouter.post("/:id/duplicate", presellController.duplicate);
presellRouter.patch("/:id/status", presellController.toggleStatus);
