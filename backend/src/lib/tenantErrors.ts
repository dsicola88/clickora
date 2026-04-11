/** Erro de isolamento multi-tenant (fail-fast). Não expor detalhes internos ao cliente em produção. */
export class TenantIsolationError extends Error {
  readonly code = "TENANT_ISOLATION";

  constructor(message: string) {
    super(message);
    this.name = "TenantIsolationError";
  }
}
