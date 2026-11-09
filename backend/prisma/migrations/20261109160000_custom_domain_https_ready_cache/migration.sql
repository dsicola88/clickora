-- Cache do último probe HTTPS (lista rápida / Ads URL sem esperar go-live).
ALTER TABLE "custom_domains" ADD COLUMN IF NOT EXISTS "https_reachable_cached" BOOLEAN;
ALTER TABLE "custom_domains" ADD COLUMN IF NOT EXISTS "https_ready_checked_at" TIMESTAMP(3);
