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

# Evita copiar o texto de exemplo da documentação (…PUBLICO… ou reticências Unicode).
case "$DATABASE_URL" in
  *PUBLICO*|*publico*)
    echo "ERRO: DATABASE_URL ainda contém o placeholder «PUBLICO»."
    echo "  No Railway → Postgres → Connect, copia a linha COMPLETA (postgresql://postgres:PASSWORD@HOST:PORT/railway?...)."
    echo "  Não uses «…» nem «PUBLICO» — substitui tudo pela URL real."
    exit 1
    ;;
esac
case "$DATABASE_URL" in
  *$'\342\200\246'*) # U+2026 …
    echo "ERRO: DATABASE_URL contém reticências «…» (placeholder). Cola a URL inteira do Railway."
    exit 1
    ;;
esac

TYPO="20240417130000_meta_copi_integration"
# Log Railway às vezes mostra este nome (não há pasta no Git; o correcto é 20260417130000_meta_capi_integration).
ALT_FAILED="20240417130800_meta_capi_integration"

echo "=== 1) Tentar prisma migrate resolve --rolled-back (nomes fantasma na BD) ==="
set +e
npx prisma migrate resolve --rolled-back "$ALT_FAILED"
r_alt=$?
npx prisma migrate resolve --rolled-back "$TYPO"
r_typo=$?
set -e

if [ "$r_alt" != 0 ] && [ "$r_typo" != 0 ]; then
  echo "=== resolve falhou para ambos (normal se o registo não existir). SQL directo ==="
  npx prisma db execute --schema prisma/schema.prisma --file scripts/delete-railway-typo-migration.sql
else
  echo "=== resolve OK (pelo menos um nome foi aceite) ==="
fi

echo "=== 2) prisma migrate deploy ==="
npx prisma migrate deploy

echo ""
echo "OK. Agora na Railway: Redeploy do serviço clickora (o contentor já passa migrate deploy)."
