import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { WorkspaceRole } from "@prisma/client";

function resolveJwtSecret(): string {
  const raw = (process.env.JWT_SECRET || "").trim();
  if (process.env.NODE_ENV === "production") {
    if (!raw || raw === "changeme" || raw.length < 32) {
      throw new Error(
        "JWT_SECRET em falta ou inseguro em produção (mín. 32 caracteres; não use 'changeme').",
      );
    }
    return raw;
  }
  return raw || "changeme";
}

const JWT_SECRET = resolveJwtSecret();
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];

export interface JwtPayload {
  userId: string;
  email: string;
  /** Dono dos dados (conta). Por omissão igual a `userId`. */
  tenantUserId?: string;
  workspaceId?: string;
  workspaceRole?: WorkspaceRole;
  /** Permissões extra do membro (ex.: rotators:write). Tokens antigos podem omitir. */
  workspacePermissions?: string[];
  /** `mfa` = token temporário até verificar TOTP. */
  purpose?: "mfa" | "session";
}

export function signToken(payload: JwtPayload, expiresIn?: SignOptions["expiresIn"]): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn ?? JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
