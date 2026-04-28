-- Otimização automática Paid Ads (Cérebro V0): auditoria + flags na campanha

ALTER TABLE "paid_ads_campaigns" ADD COLUMN "optimizer_flags" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "paid_ads_optimizer_decisions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "platform" "PaidAdsPlatform" NOT NULL,
    "rule_code" TEXT NOT NULL,
    "decision_type" TEXT NOT NULL,
    "dry_run" BOOLEAN NOT NULL DEFAULT false,
    "input_snapshot" JSONB NOT NULL DEFAULT '{}',
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "execution_ok" BOOLEAN,
    "execution_detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paid_ads_optimizer_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "paid_ads_optimizer_decisions_project_id_created_at_idx"
  ON "paid_ads_optimizer_decisions"("project_id", "created_at" DESC);

CREATE INDEX "paid_ads_optimizer_decisions_campaign_id_idx"
  ON "paid_ads_optimizer_decisions"("campaign_id");

ALTER TABLE "paid_ads_optimizer_decisions"
  ADD CONSTRAINT "paid_ads_optimizer_decisions_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "paid_ads_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "paid_ads_optimizer_decisions"
  ADD CONSTRAINT "paid_ads_optimizer_decisions_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "paid_ads_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
