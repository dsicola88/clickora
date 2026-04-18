#!/usr/bin/env sh
# Carrega DATABASE_URL de backend/railway.env e corre o fluxo P3009 (typo + migrate deploy).
# Uso: na pasta backend/, cria railway.env a partir de railway.env.example, depois:
#   npm run db:migrate:railway-p3009
set -e
cd "$(dirname "$0")/.." || exit 1

ENV_FILE="${RAILWAY_ENV_FILE:-railway.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Falta ./$ENV_FILE (estás em backend/)."
  echo "  cp railway.env.example railway.env"
  echo "  Edita railway.env: uma linha DATABASE_URL=... (Postgres na Railway → Connect / Variables)."
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "./$ENV_FILE"
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERRO: $ENV_FILE tem de definir DATABASE_URL=..."
  exit 1
fi

case "$DATABASE_URL" in
  *railway.internal*)
    echo "ERRO: DATABASE_URL aponta para *.railway.internal — do teu Mac não há rota para esse host."
    echo "  Railway → Postgres → Connect → copia a URL **pública** (proxy / TCP), não a «Private Networking»."
    echo "  Depois: npm run db:railway:check"
    exit 1
    ;;
esac

exec sh scripts/fix-railway-p3009-typo.sh
