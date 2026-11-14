#!/usr/bin/env bash
# Prova de carga mutante LOCAL (nunca Railway / dclickora.com).
# Critério profissional para falar em "centenas–milhares de sessões concorrentes"
# de forma honesta: VUs = workers do cliente de teste, não humanos únicos.
#
# Pré-requisitos: Docker Desktop a correr.
# Uso:
#   ./scripts/run-local-load-proof.sh
#   LOAD_TEST_VUS=100 LOAD_TEST_ITERATIONS=2 ./scripts/run-local-load-proof.sh
set -euo pipefail
cd "$(dirname "$0")/.."

VUS="${LOAD_TEST_VUS:-50}"
ITERS="${LOAD_TEST_ITERATIONS:-1}"
PG_PORT="${LOAD_PG_PORT:-5435}"
API_PORT="${LOAD_API_PORT:-3011}"
CONTAINER="${LOAD_PG_CONTAINER:-clickora-load-pg}"
DB_URL="postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/clickora_load"

if ! docker info >/dev/null 2>&1; then
  echo "FAIL: Docker Desktop não está a correr. Abre o Docker e volta a executar."
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker run -d --name "$CONTAINER" \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_DB=clickora_load \
    -p "${PG_PORT}:5432" \
    postgres:16-alpine
fi

echo "A aguardar Postgres em :${PG_PORT}…"
for i in $(seq 1 40); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres

export DATABASE_URL="$DB_URL"
export ALLOW_MUTATING_LOAD_TEST=1
export ALLOW_LOAD_TEST=1
export JWT_SECRET="${JWT_SECRET:-load-proof-jwt-secret-min-32-chars-xx}"
export ENCRYPTION_KEY="${ENCRYPTION_KEY:-0123456789abcdef0123456789abcdef}"
export NODE_ENV=development
export PORT="$API_PORT"
export FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:8080}"

npx prisma migrate deploy
npx prisma db seed >/dev/null 2>&1 || true
npx tsx scripts/raise-local-plan-limits-for-load.ts || true

# API dedicada (não usar a do .env Railway)
pkill -f "src/server.ts.*${API_PORT}" 2>/dev/null || true
npx tsx src/server.ts >/tmp/clickora-load-api.log 2>&1 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT

for i in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:${API_PORT}/api/health" >/dev/null; then
    break
  fi
  sleep 0.5
done
curl -sf "http://127.0.0.1:${API_PORT}/api/health" >/dev/null

EMAIL="${LOAD_TEST_EMAIL:-loadproof@example.com}"
PASS="${LOAD_TEST_PASSWORD:-LoadProof123!}"
# Garante user de carga (seed pode já ter; senão cria via script se existir)
export LOAD_TEST_BASE_URL="http://127.0.0.1:${API_PORT}"
export LOAD_TEST_VUS="$VUS"
export LOAD_TEST_ITERATIONS="$ITERS"
export LOAD_TEST_EMAIL="$EMAIL"
export LOAD_TEST_PASSWORD="$PASS"

echo "=== load:realistic VUs=${VUS} iters=${ITERS} ==="
npx tsx scripts/load-realistic-suite.ts | tee /tmp/clickora-load-proof.json

echo
echo "Interpretação honesta:"
echo "- 0 errors + p95 track/public estáveis ⇒ pronto para tráfego de campanha intenso em 1 nó."
echo "- Isto NÃO prova sozinho 'N mil utilizadores SaaS' (login + quotas + multi-tenant)."
echo "- Para milhares de contas: repetir em staging com o mesmo script + monitoramento."
