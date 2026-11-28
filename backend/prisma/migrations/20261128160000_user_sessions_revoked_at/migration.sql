-- Revogação de sessões JWT por conta (aditivo, idempotente).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sessions_revoked_at" TIMESTAMP(3);
