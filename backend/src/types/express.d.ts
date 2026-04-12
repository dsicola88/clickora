import "express";

declare global {
  namespace Express {
    interface Request {
      /** Corpo JSON bruto (para HMAC do webhook Hotmart). Preenchido por `express.json({ verify })`. */
      rawBody?: Buffer;
    }
  }
}

export {};
