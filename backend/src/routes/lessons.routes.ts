import { Router } from "express";
import { academyLessonController } from "../controllers/academyLesson.controller";
import { authenticate } from "../middleware/authenticate";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription";

export const lessonsRouter = Router();

lessonsRouter.use(authenticate, requireActiveSubscription);
lessonsRouter.get("/", academyLessonController.listPublished);
