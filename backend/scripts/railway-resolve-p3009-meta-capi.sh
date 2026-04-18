#!/usr/bin/env sh
# Prisma P3009: migração falhada na tabela _prisma_migrations bloqueia `migrate deploy`.
# Corre na máquina local com DATABASE_URL da Railway ou: railway run --service clickora sh scripts/railway-resolve-p3009-meta-capi.sh
#
# Nome correcto no Git:
MIGRATION_REPO="20260417130000_meta_capi_integration"
# Typo que alguns deploys Railway registaram na BD (não há pasta no repo):
MIGRATION_TYPO="20240417130000_meta_copi_integration"

cd "$(dirname "$0")/.." || exit 1

echo "=== Prisma P3009 (Meta CAPI / Railway) ==="
echo ""
echo "Se o log da Railway citar o TYPO: $MIGRATION_TYPO"
echo "  cd backend && DATABASE_URL=... npx prisma migrate resolve --rolled-back \"$MIGRATION_TYPO\""
echo "  npx prisma migrate deploy"
echo "Se o CLI não aceitar, SQL no Postgres (Query):"
echo "  DELETE FROM \"_prisma_migrations\" WHERE migration_name = '$MIGRATION_TYPO';"
echo ""
echo "Migração correcta no repositório: $MIGRATION_REPO"
echo ""
MIGRATION="${MIGRATION:-$MIGRATION_REPO}"
echo "=== Opções genéricas — migração: $MIGRATION ==="
echo ""
echo "Escolhe UMA opção (a partir da pasta backend/, com DATABASE_URL definido):"
echo ""
echo "A) A migração falhou ANTES de aplicar SQL (ou queres que o Prisma volte a executá-la):"
echo "   npx prisma migrate resolve --rolled-back $MIGRATION"
echo "   npx prisma migrate deploy"
echo ""
echo "B) O SQL já está na BD (colunas meta_* em users/conversions), só o estado Prisma ficou «failed»:"
echo "   npx prisma migrate resolve --applied $MIGRATION"
echo "   npx prisma migrate deploy"
echo ""
echo "Para ver colunas em Postgres (Query no plugin Railway):"
echo "   SELECT column_name FROM information_schema.columns"
echo "   WHERE table_schema='public' AND table_name='users' AND column_name LIKE 'meta_%';"
echo ""
