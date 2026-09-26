import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { WorkspaceRole } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "changeme";
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
