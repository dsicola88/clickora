ALTER TABLE "custom_domains" ADD COLUMN IF NOT EXISTS "vercel_domain_registered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "custom_domains" ADD COLUMN IF NOT EXISTS "vercel_verification_json" JSONB;
