#!/usr/bin/env sh
# Corrige P3009 para a migração 20260422120000_user_auto_blacklist_click_limit.
# Requer DATABASE_URL público do Postgres da Railway em backend/railway.env
#
# Uso (na pasta backend/):
#   npm run db:migrate:fix-railway-p3009:auto-blacklist
# Se --applied não for o caso (migração falhou antes de criar colunas):
#   npm run db:migrate:fix-railway-p3009:auto-blacklist -- rolled-back
set -e
cd "$(dirname "$0")/.." || exit 1

ENV_FILE="${RAILWAY_ENV_FILE:-railway.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Falta ./$ENV_FILE (estás em backend/)."
  echo "  cp railway.env.example railway.env"
  echo "  Edita: uma linha DATABASE_URL=\"postgresql://...\" (URL pública do Postgres na Railway)."
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "./$ENV_FILE"
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERRO: DATABASE_URL em $ENV_FILE está vazio."
  echo "  Railway → Postgres → Connect → copia a URL **pública** (não postgres.railway.internal)."
  exit 1
fi

case "$DATABASE_URL" in
  *railway.internal*)
    echo "ERRO: DATABASE_URL usa railway.internal — do teu Mac usa a URL pública (proxy TCP)."
    exit 1
    ;;
esac

MIG="20260422120000_user_auto_blacklist_click_limit"
MODE="${1:-applied}"

echo "=== prisma migrate resolve ($MODE) $MIG ==="
if [ "$MODE" = "rolled-back" ]; then
  npx prisma migrate resolve --rolled-back "$MIG"
else
  npx prisma migrate resolve --applied "$MIG"
fi

echo "=== prisma migrate deploy ==="
npx prisma migrate deploy

echo "=== OK. Faz Redeploy do serviço clickora na Railway. ==="
