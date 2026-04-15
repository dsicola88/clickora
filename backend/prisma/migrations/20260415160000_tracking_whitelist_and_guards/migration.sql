-- Tracking: whitelist + opt-in guards (bots / empty UA)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "block_empty_user_agent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "block_bot_clicks" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "whitelisted_ips" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whitelisted_ips_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whitelisted_ips_user_id_ip_address_key" ON "whitelisted_ips"("user_id", "ip_address");
CREATE INDEX IF NOT EXISTS "whitelisted_ips_user_id_idx" ON "whitelisted_ips"("user_id");

DO $$ BEGIN
  ALTER TABLE "whitelisted_ips" ADD CONSTRAINT "whitelisted_ips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
