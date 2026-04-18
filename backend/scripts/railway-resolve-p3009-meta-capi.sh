#!/usr/bin/env sh
# Prisma P3009: migração falhada na tabela _prisma_migrations bloqueia `migrate deploy`.
# Corre na máquina local com DATABASE_URL da Railway ou: railway run --service clickora sh scripts/railway-resolve-p3009-meta-capi.sh
#
# Nome correcto no Git:
MIGRATION_REPO="20260417130000_meta_capi_integration"
# Nomes fantasma que alguns deploys Railway registaram na BD (não há pastas no repo):
MIGRATION_TYPO="20240417130000_meta_copi_integration"
MIGRATION_ALT_FAILED="20240417130800_meta_capi_integration"

cd "$(dirname "$0")/.." || exit 1

echo "=== Prisma P3009 (Meta CAPI / Railway) ==="
echo ""
echo "Se o log da Railway citar um destes nomes (não existem no Git):"
echo "  $MIGRATION_ALT_FAILED"
echo "  $MIGRATION_TYPO"
echo "  cd backend && DATABASE_URL=... npx prisma migrate resolve --rolled-back \"<nome-exacto-do-log>\""
echo "  npx prisma migrate deploy"
echo "Se o CLI não aceitar: psql / railway connect postgres / cliente gráfico — SQL:"
echo "  DELETE FROM \"_prisma_migrations\" WHERE migration_name IN ('$MIGRATION_ALT_FAILED', '$MIGRATION_TYPO');"
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
echo "Para ver colunas em Postgres (psql ou cliente):"
echo "   SELECT column_name FROM information_schema.columns"
echo "   WHERE table_schema='public' AND table_name='users' AND column_name LIKE 'meta_%';"
echo ""
