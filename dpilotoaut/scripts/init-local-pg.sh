#!/usr/bin/env bash
# Cria o utilizador dpiloto e a base paid_autopilot no PostgreSQL local (porta 5432).
# Não precisa de Docker. Requer: psql acessível e um utilizador com permissão para CREATE ROLE/DB.
# Uso: na raiz do repositório → bash scripts/init-local-pg.sh

set -euo pipefail
HOST="127.0.0.1"
PORT="5432"
DB="postgres"
export PGPASSWORD="${PGPASSWORD:-}"
export PGHOST="${PGHOST:-$HOST}"
export PGPORT="${PGPORT:-$PORT}"

if ! command -v psql >/dev/null 2>&1; then
  echo "ERRO: Comando 'psql' não encontrado. Instale o cliente PostgreSQL (ex.: Homebrew) ou use Docker: npm run db:up"
  exit 1
fi

echo "A ligar a postgresql://$HOST:$PORT/$DB (utilizador: ${PGUSER:-$(whoami 2>/dev/null || echo "default")})"
echo

psql -v ON_ERROR_STOP=1 -d "$DB" <<'SQL' || { echo "Falha ao criar o role dpiloto. Tente: PGUSER=postgres bash scripts/init-local-pg.sh"; exit 1; }
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dpiloto') THEN
    CREATE ROLE dpiloto LOGIN PASSWORD 'dpiloto' CREATEDB;
  ELSE
    ALTER ROLE dpiloto WITH LOGIN PASSWORD 'dpiloto';
  END IF;
END
$$;
SQL

EXISTS=$(psql -d "$DB" -tAc "SELECT 1 FROM pg_database WHERE datname = 'paid_autopilot'" 2>/dev/null || echo "")
if [ "$EXISTS" = "1" ]; then
  echo "Base 'paid_autopilot' já existe."
else
  psql -d "$DB" -v ON_ERROR_STOP=1 -c "CREATE DATABASE paid_autopilot OWNER dpiloto;" || {
    echo "Falha ao criar a base. Verifique se o utilizador atual tem permissões."
    exit 1
  }
  echo "Base 'paid_autopilot' criada."
fi

echo
echo "OK. No .env use: DATABASE_URL=\"postgresql://dpiloto:dpiloto@127.0.0.1:5432/paid_autopilot\""
echo "Depois, na raiz do repo: npm run db:setup   (ou: npm run db:push && npm run db:seed)"
