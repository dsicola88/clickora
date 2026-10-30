-- CreateEnum
CREATE TYPE "PresellComplianceJobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "presell_compliance_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "presell_id" TEXT NOT NULL,
    "content_fingerprint" VARCHAR(64) NOT NULL,
    "skip_destination_probe" BOOLEAN NOT NULL DEFAULT true,
    "status" "PresellComplianceJobStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "run_after" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_owner" VARCHAR(128),
    "lease_until" TIMESTAMP(3),
    "last_error" VARCHAR(500),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "presell_compliance_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "presell_compliance_jobs_status_run_after_idx" ON "presell_compliance_jobs"("status", "run_after");
CREATE INDEX "presell_compliance_jobs_presell_id_status_idx" ON "presell_compliance_jobs"("presell_id", "status");
CREATE INDEX "presell_compliance_jobs_user_id_created_at_idx" ON "presell_compliance_jobs"("user_id", "created_at");
CREATE INDEX "presell_compliance_jobs_lease_until_idx" ON "presell_compliance_jobs"("lease_until");
CREATE UNIQUE INDEX "presell_compliance_jobs_active_dedupe_idx"
  ON "presell_compliance_jobs"("presell_id", "content_fingerprint", "skip_destination_probe")
  WHERE "status" IN ('pending', 'processing');
ALTER TABLE "presell_compliance_jobs" ADD CONSTRAINT "presell_compliance_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "presell_compliance_jobs" ADD CONSTRAINT "presell_compliance_jobs_presell_id_fkey" FOREIGN KEY ("presell_id") REFERENCES "presell_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
