#!/usr/bin/env bash
# Migra a BD e corre o teste do fluxo de domínio personalizado.
# Requer: Docker (PostgreSQL em localhost:5433) e backend/.env com DATABASE_URL.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Subindo PostgreSQL..."
if ! docker start clickora-postgres 2>/dev/null; then
  docker compose up -d
fi

echo "==> Aguardando a porta 5433..."
for i in $(seq 1 30); do
  if command -v nc >/dev/null 2>&1 && nc -z localhost 5433 2>/dev/null; then
    break
  fi
  sleep 1
done

echo "==> prisma migrate deploy"
(cd backend && npx prisma migrate deploy)

echo "==> npm run test:custom-domain (backend)"
(cd backend && npm run test:custom-domain)

echo "==> Concluído."
