-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" TEXT;

-- CreateIndex (PostgreSQL: vários NULL são permitidos num UNIQUE)
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_key" ON "users"("google_id");
