/** Cliente sem isolamento Prisma-tenant: rotas paid filtram por `userId` / project manualmente. */
import { systemPrisma } from "../lib/prisma";

export const prisma = systemPrisma;
