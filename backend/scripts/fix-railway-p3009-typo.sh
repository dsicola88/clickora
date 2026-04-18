#!/usr/bin/env sh
# Corrige P3009 na Railway quando a BD tem migração falhada com typo:
#   20240417130000_meta_copi_integration
# Depois corre `prisma migrate deploy` (migração correcta: 20260417130000_meta_capi_integration).
#
# Uso (copia DATABASE_URL do Postgres na Railway → Variables ou Connect):
#   cd backend && DATABASE_URL='postgresql://...' npm run db:migrate:fix-railway-p3009-typo
#
set -e
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERRO: define DATABASE_URL."
  echo "  Railway → Postgres → Connect → copia a URL (usa a direct/internal se o Prisma pedir)."
  echo "  Exemplo: cd backend && DATABASE_URL='postgresql://...' npm run db:migrate:fix-railway-p3009-typo"
  exit 1
fi

TYPO="20240417130000_meta_copi_integration"

echo "=== 1) Tentar prisma migrate resolve --rolled-back ($TYPO) ==="
set +e
npx prisma migrate resolve --rolled-back "$TYPO"
resolve_ok=$?
set -e

if [ "$resolve_ok" != 0 ]; then
  echo "=== resolve falhou (esperado se o nome não existe em prisma/migrations). SQL directo ==="
  npx prisma db execute --schema prisma/schema.prisma --file scripts/delete-railway-typo-migration.sql
else
  echo "=== resolve OK ==="
fi

echo "=== 2) prisma migrate deploy ==="
npx prisma migrate deploy

echo ""
echo "OK. Agora na Railway: Redeploy do serviço clickora (o contentor já passa migrate deploy)."
