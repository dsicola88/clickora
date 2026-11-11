#!/usr/bin/env bash
# Staging local: Postgres:5434 + Redis + gates (nunca Railway).
# Uso (na raiz do repo):
#   cp scripts/local-staging.env.example scripts/local-staging.env   # opcional
#   bash scripts/run-local-staging-gates.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f scripts/local-staging.env ]]; then
  # shellcheck disable=SC1091
  set -a && source scripts/local-staging.env && set +a
else
  # shellcheck disable=SC1091
  set -a && source scripts/local-staging.env.example && set +a
fi

case "${DATABASE_URL}" in
  *localhost*|*127.0.0.1*) ;;
  *)
    echo "ABORT: DATABASE_URL não é localhost: ${DATABASE_URL}"
    exit 1
    ;;
esac
case "${DATABASE_URL}" in
  *railway*|*rlwy.net*|*dclickora.com*)
    echo "ABORT: DATABASE_URL parece produção/Railway"
    exit 1
    ;;
esac

echo "== docker compose (postgres + redis) =="
docker compose up -d
docker compose ps

echo "== migrate + seed (local) =="
(
  cd backend
  npx prisma migrate deploy
  npx prisma db seed
)

echo "== start API :${PORT} =="
(
  cd backend
  npm run build
  node dist/server.js &
  echo $! > /tmp/clickora-local-api.pid
)
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
    echo "API up"
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "API health timeout"
    exit 1
  fi
  sleep 1
done

cleanup() {
  if [[ -f /tmp/clickora-local-api.pid ]]; then
    kill "$(cat /tmp/clickora-local-api.pid)" 2>/dev/null || true
    rm -f /tmp/clickora-local-api.pid
  fi
}
trap cleanup EXIT

echo "== load smoke (safe) =="
(
  cd backend
  npm run load:smoke
)

echo "== security isolation (IDOR) =="
(
  cd backend
  npm run test:security-isolation
)

echo "== Playwright login smoke (API herdará DATABASE_URL local) =="
(
  cd frontend
  # Playwright webServer usa :3001 — exportar PORT para o filho api:dev
  PORT=3001 LOAD_TEST_BASE_URL=http://127.0.0.1:3001 \
    npx playwright test e2e/login.spec.ts --reporter=list
)

echo "OK — gates locais concluídos (Postgres+Redis+load+IDOR+Playwright login)."
