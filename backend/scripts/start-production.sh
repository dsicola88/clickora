#!/usr/bin/env sh
set -e
cd /app/backend

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. In Railway, link the Postgres service to this service or set DATABASE_URL."
  exit 1
fi

echo "=== prisma migrate deploy ==="
if ! npx prisma migrate deploy; then
  echo "ERROR: prisma migrate deploy failed."
  echo "Check: (1) DATABASE_URL points to Postgres (Railway: use the variable from the Postgres plugin, often postgres.railway.internal)."
  echo "       (2) Public/proxy URLs often need ?sslmode=require at the end."
  echo "       (3) If Railway gives a pooled URL, use the direct/private URL for migrations (see Prisma directUrl)."
  exit 1
fi

if [ "${SKIP_DB_SEED:-}" = "1" ] || [ "${SKIP_DB_SEED:-}" = "true" ]; then
  echo "=== SKIP prisma db seed (SKIP_DB_SEED) ==="
else
  echo "=== prisma db seed ==="
  if ! npx prisma db seed; then
    echo "ERROR: prisma db seed failed (migrations may have applied; fix seed or prisma/seed.ts)."
    echo "Para arrancar sem seed (emergência): define SKIP_DB_SEED=true no Railway."
    exit 1
  fi
fi

echo "=== node dist/server.js ==="
exec node dist/server.js
