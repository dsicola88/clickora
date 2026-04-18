#!/usr/bin/env sh
# Testa ligação à BD usando o mesmo railway.env que db:migrate:railway-p3009 (sem imprimir a URL).
set -e
cd "$(dirname "$0")/.." || exit 1

ENV_FILE="${RAILWAY_ENV_FILE:-railway.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Falta ./$ENV_FILE — copia railway.env.example para railway.env e cola DATABASE_URL."
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "./$ENV_FILE"
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERRO: $ENV_FILE não define DATABASE_URL."
  exit 1
fi

case "$DATABASE_URL" in
  *railway.internal*)
    echo "ERRO: DATABASE_URL usa host *.railway.internal — a partir do teu Mac isso NÃO liga."
    echo "  Na Railway: Postgres → Connect → usa a URL TCP pública (ex.: *.proxy.rlwy.net), não a «private»/internal."
    echo "  Acrescenta no fim se pedirem SSL: ?sslmode=require"
    exit 1
    ;;
esac

echo "=== prisma migrate status (só diagnóstico) ==="
npx prisma migrate status
