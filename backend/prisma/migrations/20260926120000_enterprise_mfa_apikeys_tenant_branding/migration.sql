-- Enterprise: MFA TOTP, API keys B2B, white-label por tenant, OIDC subject

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_secret_enc" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_backup_codes" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "oidc_subject" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_oidc_subject_key" ON "users"("oidc_subject");

CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "key_prefix" VARCHAR(16) NOT NULL,
  "key_hash" TEXT NOT NULL,
  "scopes" JSONB NOT NULL DEFAULT '["read","write"]',
  "last_used_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_key_hash_key" ON "api_keys"("key_hash");
CREATE INDEX IF NOT EXISTS "api_keys_user_id_idx" ON "api_keys"("user_id");
CREATE INDEX IF NOT EXISTS "api_keys_key_prefix_idx" ON "api_keys"("key_prefix");

DO $$ BEGIN
  ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "tenant_branding" (
  "user_id" TEXT NOT NULL,
  "brand_name" VARCHAR(120),
  "logo_url" TEXT,
  "favicon_url" TEXT,
  "primary_color" VARCHAR(32),
  "accent_color" VARCHAR(32),
  "hide_powered_by" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_branding_pkey" PRIMARY KEY ("user_id")
);

DO $$ BEGIN
  ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
