import { Router } from "express";
import { webhookController } from "../controllers/webhook.controller";

export const webhookRouter = Router();

webhookRouter.post("/hotmart", webhookController.hotmart);
