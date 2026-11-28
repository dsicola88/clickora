-- Script de rollback para 20261128160000_user_sessions_revoked_at
-- ATENÇÃO: Executar manualmente apenas se precisar reverter. Sem a coluna, as sessões deixam de poder ser revogadas
-- (o backend continua a autenticar; `scripts/ensure-pro-columns.ts` volta a criá-la no próximo arranque).

ALTER TABLE "users" DROP COLUMN IF EXISTS "sessions_revoked_at";
