import { AsyncLocalStorage } from "async_hooks";

/** Contexto de tenant obrigatório para o cliente Prisma tenant-safe (AsyncLocalStorage). */
export type TenantContext = {
  tenantId: string;
};

const storage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}
