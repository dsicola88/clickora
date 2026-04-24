import rateLimit from "express-rate-limit";

/** Rotas de credenciais (login, registo, recuperação) — por IP. */
export const authCredentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas tentativas. Tente novamente dentro de alguns minutos." },
});
