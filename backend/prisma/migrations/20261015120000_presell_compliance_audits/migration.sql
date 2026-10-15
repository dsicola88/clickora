-- Conformidade publicitária (verificações internas). Migração incremental e não destrutiva.

CREATE TYPE "PresellComplianceGate" AS ENUM (
  'unchecked',
  'checking',
  'needs_review',
  'blocked',
  'ready_for_review'
);

ALTER TABLE "presell_pages"
  ADD COLUMN IF NOT EXISTS "compliance_gate" "PresellComplianceGate" NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS "last_compliance_audit_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_compliance_audit_id" TEXT,
  ADD COLUMN IF NOT EXISTS "content_fingerprint" VARCHAR(64);

CREATE INDEX IF NOT EXISTS "presell_pages_compliance_gate_idx" ON "presell_pages"("compliance_gate");

CREATE TABLE IF NOT EXISTS "presell_compliance_audits" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "presell_id" TEXT NOT NULL,
  "rules_version" VARCHAR(64) NOT NULL,
  "gate" VARCHAR(32) NOT NULL,
  "google_gate" VARCHAR(32) NOT NULL,
  "microsoft_gate" VARCHAR(32) NOT NULL,
  "content_fingerprint" VARCHAR(64) NOT NULL,
  "results" JSONB NOT NULL,
  "disclaimer" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "presell_compliance_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "presell_compliance_audits_user_id_presell_id_created_at_idx"
  ON "presell_compliance_audits"("user_id", "presell_id", "created_at");
CREATE INDEX IF NOT EXISTS "presell_compliance_audits_presell_id_created_at_idx"
  ON "presell_compliance_audits"("presell_id", "created_at");

CREATE TABLE IF NOT EXISTS "presell_compliance_decisions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "presell_id" TEXT NOT NULL,
  "audit_id" TEXT NOT NULL,
  "rule_id" VARCHAR(32) NOT NULL,
  "decision" VARCHAR(32) NOT NULL,
  "reason" TEXT NOT NULL,
  "decided_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "presell_compliance_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "presell_compliance_decisions_presell_id_created_at_idx"
  ON "presell_compliance_decisions"("presell_id", "created_at");
CREATE INDEX IF NOT EXISTS "presell_compliance_decisions_user_id_rule_id_idx"
  ON "presell_compliance_decisions"("user_id", "rule_id");

DO $$ BEGIN
  ALTER TABLE "presell_compliance_audits"
    ADD CONSTRAINT "presell_compliance_audits_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "presell_compliance_audits"
    ADD CONSTRAINT "presell_compliance_audits_presell_id_fkey"
    FOREIGN KEY ("presell_id") REFERENCES "presell_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "presell_compliance_decisions"
    ADD CONSTRAINT "presell_compliance_decisions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "presell_compliance_decisions"
    ADD CONSTRAINT "presell_compliance_decisions_presell_id_fkey"
    FOREIGN KEY ("presell_id") REFERENCES "presell_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "presell_compliance_decisions"
    ADD CONSTRAINT "presell_compliance_decisions_audit_id_fkey"
    FOREIGN KEY ("audit_id") REFERENCES "presell_compliance_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
