import { Router } from "express";
import { webhookController } from "../controllers/webhook.controller";

export const webhookRouter = Router();

/** GET só para verificar que a URL está acessível; a Hotmart usa sempre POST. */
webhookRouter.get("/hotmart", (_req, res) => {
  res.status(200).json({
    ok: true,
    message:
      "Endpoint do webhook Hotmart. A Hotmart envia pedidos POST com o evento; abrir esta página no browser (GET) não dispara uma compra — é normal.",
  });
});

webhookRouter.post("/hotmart", webhookController.hotmart);
