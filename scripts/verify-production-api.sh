#!/usr/bin/env bash
# Verificação rápida: Railway direto + proxy Vercel + rotas públicas.
# Uso: ./scripts/verify-production-api.sh
#      BASE=https://www.dclickora.com RAILWAY=https://xxx.up.railway.app ./scripts/verify-production-api.sh

set -euo pipefail

BASE="${BASE:-https://www.dclickora.com}"
RAILWAY="${RAILWAY:-https://clickora-production.up.railway.app}"

code() {
  curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 20 "$1" || echo "ERR"
}

echo "=== dclickora — verificação de API (produção) ==="
echo "Railway direto:    GET $RAILWAY/api/health  -> $(code "$RAILWAY/api/health") (esperado 200)"
echo "Proxy Vercel www:  GET $BASE/api/health     -> $(code "$BASE/api/health") (esperado 200)"
echo "GET /api/plans:                       -> $(code "$BASE/api/plans") (esperado 200)"
echo "GET /api/public/branding:             -> $(code "$BASE/api/public/branding") (esperado 200)"
echo "GET /api/public/plans-landing:        -> $(code "$BASE/api/public/plans-landing") (esperado 200)"
echo "GET /api/analytics/dashboard (s/token): -> $(code "$BASE/api/analytics/dashboard") (esperado 401)"
echo ""
echo "Health (corpo):"
curl -sS --connect-timeout 15 "$BASE/api/health" | head -c 120 || true
echo ""
echo "=== Fim ==="
