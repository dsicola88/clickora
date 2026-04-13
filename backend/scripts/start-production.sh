#!/usr/bin/env sh
set -e
cd /app/backend

# Menos ruído / prompts do Prisma no arranque (logs mais limpos em Docker).
export CI="${CI:-true}"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. In Railway, link the Postgres service to this service or set DATABASE_URL."
  exit 1
fi

# Web Push: o Node só vê o que o Railway injeta neste serviço. Não imprimir valores.
if [ -z "${VAPID_PRIVATE_KEY:-}" ]; then
  echo "WARN: VAPID_PRIVATE_KEY is NOT set in this container — Web Push disabled. Add it on the API service (clickora) Variables, Save, then Redeploy. If it appears in the UI but not here, remove and re-add the variable or check Shared Variables / wrong service."
else
  echo "OK: VAPID_PRIVATE_KEY is set (length ${#VAPID_PRIVATE_KEY})."
fi
if [ -z "${VAPID_PUBLIC_KEY:-}" ]; then
  echo "WARN: VAPID_PUBLIC_KEY is NOT set."
else
  echo "OK: VAPID_PUBLIC_KEY is set (length ${#VAPID_PUBLIC_KEY})."
fi
if [ -n "${VAPID_KEYS_JSON:-}" ]; then
  echo "OK: VAPID_KEYS_JSON is set (length ${#VAPID_KEYS_JSON}) — alternativa às duas chaves separadas."
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

# Seed no arranque é opt-in: correr em todo o deploy bloqueava/hang e causava 502 na Railway.
# Primeiro deploy ou quando precisares de dados iniciais: RUN_SEED_ON_START=true (uma vez) ou `railway run npx prisma db seed`.
run_seed=false
if [ "${SKIP_DB_SEED:-}" = "1" ] || [ "${SKIP_DB_SEED:-}" = "true" ]; then
  echo "=== SKIP prisma db seed (SKIP_DB_SEED) ==="
elif [ "${RUN_SEED_ON_START:-}" = "1" ] || [ "${RUN_SEED_ON_START:-}" = "true" ]; then
  run_seed=true
else
  echo "=== SKIP prisma db seed (defeito — evita 502 por seed no arranque). Dados iniciais: RUN_SEED_ON_START=true uma vez ou prisma db seed manual ==="
fi

if [ "$run_seed" = "true" ]; then
  echo "=== prisma db seed (RUN_SEED_ON_START, max 180s; falha não bloqueia o servidor) ==="
  set +e
  if command -v timeout >/dev/null 2>&1; then
    timeout 180 npx prisma db seed
    SEED_EXIT=$?
  else
    npx prisma db seed
    SEED_EXIT=$?
  fi
  set -e
  if [ "$SEED_EXIT" != 0 ]; then
    echo "WARN: prisma db seed exit $SEED_EXIT (erro ou timeout). API arranca na mesma."
  else
    echo "=== prisma db seed OK ==="
  fi
fi

echo "=== node dist/server.js ==="
exec node dist/server.js
