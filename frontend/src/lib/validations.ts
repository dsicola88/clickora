import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().trim().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const recoverySchema = z.object({
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirme sua senha"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

function isBlockedProductUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return true;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return true;
    if (/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
    return false;
  } catch {
    return true;
  }
}

const presellCreatorStep1Fields = z.object({
  pageName: z.string().min(1, "Nome do projeto é obrigatório"),
  productLink: z
    .string()
    .min(1, "Cole o URL da página de vendas a importar")
    .url("Link inválido. Use um URL completo (https://...)"),
  language: z.string().min(1, "Selecione o idioma"),
  affiliateLink: z.string().optional(),
});

/** Passo 1 do assistente (fluxo próximo de ferramentas como SpeedyPresell): projeto + URLs. */
export const presellCreatorStep1Schema = presellCreatorStep1Fields
  .refine((d) => !isBlockedProductUrl(d.productLink), {
    message: "Use o link público da página (ex.: theneotonics.com), não localhost.",
    path: ["productLink"],
  })
  .refine(
    (d) => {
      const a = (d.affiliateLink ?? "").trim();
      if (!a) return true;
      try {
        const u = new URL(a);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Link de afiliado inválido.", path: ["affiliateLink"] },
  )
  .refine(
    (d) => {
      const a = (d.affiliateLink ?? "").trim();
      if (!a) return true;
      return !isBlockedProductUrl(a);
    },
    { message: "Use um link de afiliado público (não localhost).", path: ["affiliateLink"] },
  );

/** Criador automático: importação por URL, link de afiliado opcional, idioma, tipo, nome e endereço. */
export const presellAutoCreatorSchema = presellCreatorStep1Fields
  .extend({
    pageSlug: z.string().optional(),
    category: z.string().optional(),
    presellType: z.string().min(1, "Selecione o tipo da presell"),
  })
  .refine((d) => !isBlockedProductUrl(d.productLink), {
    message: "Use o link público da página (ex.: theneotonics.com), não localhost.",
    path: ["productLink"],
  })
  .refine(
    (d) => {
      const a = (d.affiliateLink ?? "").trim();
      if (!a) return true;
      try {
        const u = new URL(a);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Link de afiliado inválido.", path: ["affiliateLink"] },
  )
  .refine(
    (d) => {
      const a = (d.affiliateLink ?? "").trim();
      if (!a) return true;
      return !isBlockedProductUrl(a);
    },
    { message: "Use um link de afiliado público (não localhost).", path: ["affiliateLink"] },
  );


export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
export type RecoveryForm = z.infer<typeof recoverySchema>;
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
export type PresellAutoCreatorForm = z.infer<typeof presellAutoCreatorSchema>;
export type PresellCreatorForm = PresellAutoCreatorForm;
