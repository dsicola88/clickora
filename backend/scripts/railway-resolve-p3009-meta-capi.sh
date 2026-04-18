#!/usr/bin/env sh
# Prisma P3009: migração falhada na tabela _prisma_migrations bloqueia `migrate deploy`.
# Corre na máquina local com DATABASE_URL da Railway ou: railway run --service clickora sh scripts/railway-resolve-p3009-meta-capi.sh
#
# Nome no repositório (não confundir com 202404...):
MIGRATION="${MIGRATION:-20260417130000_meta_capi_integration}"

cd "$(dirname "$0")/.." || exit 1

echo "=== Prisma P3009 — migração: $MIGRATION ==="
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
