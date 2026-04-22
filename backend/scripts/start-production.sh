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
if [ -n "${VAPID_PRIVATE_KEY_B64:-}" ]; then
  echo "OK: VAPID_PRIVATE_KEY_B64 is set (length ${#VAPID_PRIVATE_KEY_B64})."
fi
if [ -n "${VAPID_KEYS_JSON_B64:-}" ]; then
  echo "OK: VAPID_KEYS_JSON_B64 is set (length ${#VAPID_KEYS_JSON_B64})."
fi

echo "=== prisma migrate deploy ==="
APP_DATABASE_URL="$DATABASE_URL"
MIGRATE_URL="$APP_DATABASE_URL"
if [ -n "${DATABASE_URL_MIGRATE:-}" ]; then
  MIGRATE_URL="$DATABASE_URL_MIGRATE"
  echo "INFO: DATABASE_URL_MIGRATE definido — só as migrações usam esta URL; a API continua com DATABASE_URL."
fi

migrate_ok=0
attempt=1
max_attempts=15
while [ "$attempt" -le "$max_attempts" ]; do
  export DATABASE_URL="$MIGRATE_URL"
  if npx prisma migrate deploy; then
    migrate_ok=1
    break
  fi
  echo "WARN: migrate deploy falhou (tentativa $attempt/$max_attempts). Nova tentativa em 2s…"
  attempt=$((attempt + 1))
  sleep 2
done

export DATABASE_URL="$APP_DATABASE_URL"

if [ "$migrate_ok" != 1 ]; then
  echo "ERROR: prisma migrate deploy falhou após $max_attempts tentativas."
  echo "Railway / Postgres:"
  echo "  (1) No serviço da API: Variables → liga o Postgres com «Reference» (variável DATABASE_URL do plugin), não copies URLs à mão se possível."
  echo "  (2) Se vês P1001 com postgres.railway.internal: rede privada ou arranque do Postgres — espera e redeploy; ou define DATABASE_URL_MIGRATE com a URL pública (proxy *.rlwy.net) + ?sslmode=require só para migrações."
  echo "  (3) URLs públicas: acrescenta ?sslmode=require ao fim se a Railway o exigir."
  echo "  (4) P3009: migração falhada — ver backend/README (fix-railway-p3009:auto-blacklist)."
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
