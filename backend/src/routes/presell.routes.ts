import { Router, type Request, type Response, type NextFunction } from "express";
import { presellController } from "../controllers/presell.controller";
import { authenticate } from "../middleware/authenticate";
import { tenantIsolation } from "../middleware/tenantIsolation";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";
import { presellBuilderMediaUpload } from "../lib/presellBuilderMediaUpload";

export const presellRouter = Router();

presellRouter.use(authenticate, tenantIsolation, requireActiveSubscription);

function handleBuilderMediaUpload(req: Request, res: Response, next: NextFunction) {
  presellBuilderMediaUpload.single("image")(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Erro no upload";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}

presellRouter.get("/", presellController.getAll);
presellRouter.get("/count", presellController.getCount);
presellRouter.post("/import-from-url", presellController.importFromUrl);
presellRouter.post(
  "/builder-media",
  handleBuilderMediaUpload,
  presellController.uploadBuilderMedia,
);
presellRouter.get("/:id", presellController.getById);
presellRouter.post("/", presellController.create);
presellRouter.put("/:id", presellController.update);
presellRouter.delete("/:id", presellController.delete);
presellRouter.post("/:id/duplicate", presellController.duplicate);
presellRouter.patch("/:id/status", presellController.toggleStatus);
