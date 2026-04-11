#!/usr/bin/env sh
set -e
cd /app/backend

# Menos ruído / prompts do Prisma no arranque (logs mais limpos em Docker).
export CI="${CI:-true}"

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
echo "=== prisma migrate deploy OK ==="

if [ "${SKIP_DB_SEED:-}" = "1" ] || [ "${SKIP_DB_SEED:-}" = "true" ]; then
  echo "=== SKIP prisma db seed (SKIP_DB_SEED) ==="
else
  echo "=== prisma db seed (max 180s; se falhar ou exceder tempo, o servidor arranca na mesma) ==="
  set +e
  # timeout(1) existe na imagem Debian slim; evita seed a bloquear o arranque indefinidamente (502).
  if command -v timeout >/dev/null 2>&1; then
    timeout 180 npx prisma db seed
    SEED_EXIT=$?
  else
    npx prisma db seed
    SEED_EXIT=$?
  fi
  set -e
  if [ "$SEED_EXIT" != 0 ]; then
    echo "WARN: prisma db seed exit $SEED_EXIT (erro ou timeout). API vai arrancar na mesma. Corrige o seed ou usa SKIP_DB_SEED=true."
  fi
fi

echo "=== node dist/server.js ==="
exec node dist/server.js
