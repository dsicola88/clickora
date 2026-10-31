-- Fila persistente de sync ads (Meta CAPI / TikTok / Google Offline) com retries.
CREATE TABLE IF NOT EXISTS "conversion_sync_jobs" (
  "id" TEXT NOT NULL,
  "conversion_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "run_after" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_owner" TEXT,
  "lease_until" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversion_sync_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "conversion_sync_jobs_status_run_after_idx"
  ON "conversion_sync_jobs"("status", "run_after");

CREATE INDEX IF NOT EXISTS "conversion_sync_jobs_conversion_id_idx"
  ON "conversion_sync_jobs"("conversion_id");

CREATE UNIQUE INDEX IF NOT EXISTS "conversion_sync_jobs_conv_channel_pending_uidx"
  ON "conversion_sync_jobs"("conversion_id", "channel")
  WHERE "status" IN ('pending', 'processing');

ALTER TABLE "conversion_sync_jobs"
  ADD CONSTRAINT "conversion_sync_jobs_conversion_id_fkey"
  FOREIGN KEY ("conversion_id") REFERENCES "conversions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversion_sync_jobs"
  ADD CONSTRAINT "conversion_sync_jobs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
