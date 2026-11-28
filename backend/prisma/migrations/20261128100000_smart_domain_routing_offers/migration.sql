-- Smart Domain Routing & Presell Continuity (Etapa 1)
-- Migração idempotente e não destrutiva + backfill seguro dos dados existentes.

-- ========================
-- 1) Enums
-- ========================
DO $$ BEGIN
  CREATE TYPE "DomainRoutingRole" AS ENUM ('primary', 'backup', 'standby');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DomainHealthStatus" AS ENUM ('healthy', 'degraded', 'down', 'unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OfferValidationStatus" AS ENUM ('unchecked', 'valid', 'warning', 'blocked');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DomainRoutingEventType" AS ENUM (
    'health_check_passed',
    'health_check_degraded',
    'health_check_failed',
    'auto_failover',
    'auto_recovery',
    'manual_swap',
    'manual_rollback',
    'role_changed',
    'domain_disabled',
    'domain_enabled',
    'offer_validated',
    'offer_blocked',
    'binding_updated'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================
-- 2) Extensões em custom_domains
-- ========================
ALTER TABLE "custom_domains"
  ADD COLUMN IF NOT EXISTS "routing_role" "DomainRoutingRole" NOT NULL DEFAULT 'standby',
  ADD COLUMN IF NOT EXISTS "health_status" "DomainHealthStatus" NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "last_health_check_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_health_error" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "last_http_status" INTEGER,
  ADD COLUMN IF NOT EXISTS "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "auto_recover" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "disabled_reason" VARCHAR(240),
  ADD COLUMN IF NOT EXISTS "routing_priority" INTEGER NOT NULL DEFAULT 100;

CREATE INDEX IF NOT EXISTS "custom_domains_user_id_is_active_health_status_idx"
  ON "custom_domains"("user_id", "is_active", "health_status");

-- ========================
-- 3) Tabela offers
-- ========================
CREATE TABLE IF NOT EXISTS "offers" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "network" VARCHAR(64),
  "hoplink_url" TEXT NOT NULL,
  "backup_hoplink_url" TEXT,
  "validation_status" "OfferValidationStatus" NOT NULL DEFAULT 'unchecked',
  "compliance_passed" BOOLEAN NOT NULL DEFAULT false,
  "last_validated_at" TIMESTAMP(3),
  "last_validation_error" VARCHAR(500),
  "resolved_final_host" VARCHAR(255),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "offers_user_id_is_active_idx" ON "offers"("user_id", "is_active");
CREATE INDEX IF NOT EXISTS "offers_user_id_created_at_idx" ON "offers"("user_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "offers"
    ADD CONSTRAINT "offers_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================
-- 4) Colunas offer_id em presell_pages e affiliate_campaigns
-- ========================
ALTER TABLE "presell_pages" ADD COLUMN IF NOT EXISTS "offer_id" TEXT;
CREATE INDEX IF NOT EXISTS "presell_pages_offer_id_idx" ON "presell_pages"("offer_id");

DO $$ BEGIN
  ALTER TABLE "presell_pages"
    ADD CONSTRAINT "presell_pages_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "affiliate_campaigns" ADD COLUMN IF NOT EXISTS "offer_id" TEXT;
CREATE INDEX IF NOT EXISTS "affiliate_campaigns_offer_id_idx" ON "affiliate_campaigns"("offer_id");

DO $$ BEGIN
  ALTER TABLE "affiliate_campaigns"
    ADD CONSTRAINT "affiliate_campaigns_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================
-- 5) Tabela presell_domain_bindings
-- ========================
CREATE TABLE IF NOT EXISTS "presell_domain_bindings" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "presell_id" TEXT NOT NULL,
  "custom_domain_id" TEXT NOT NULL,
  "role" "DomainRoutingRole" NOT NULL DEFAULT 'backup',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "presell_domain_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "presell_domain_bindings_presell_id_custom_domain_id_key"
  ON "presell_domain_bindings"("presell_id", "custom_domain_id");
CREATE INDEX IF NOT EXISTS "presell_domain_bindings_user_id_presell_id_is_active_idx"
  ON "presell_domain_bindings"("user_id", "presell_id", "is_active");
CREATE INDEX IF NOT EXISTS "presell_domain_bindings_custom_domain_id_idx"
  ON "presell_domain_bindings"("custom_domain_id");

DO $$ BEGIN
  ALTER TABLE "presell_domain_bindings"
    ADD CONSTRAINT "presell_domain_bindings_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "presell_domain_bindings"
    ADD CONSTRAINT "presell_domain_bindings_presell_id_fkey"
    FOREIGN KEY ("presell_id") REFERENCES "presell_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "presell_domain_bindings"
    ADD CONSTRAINT "presell_domain_bindings_custom_domain_id_fkey"
    FOREIGN KEY ("custom_domain_id") REFERENCES "custom_domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================
-- 6) Tabela offer_domain_bindings
-- ========================
CREATE TABLE IF NOT EXISTS "offer_domain_bindings" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "offer_id" TEXT NOT NULL,
  "custom_domain_id" TEXT NOT NULL,
  "role" "DomainRoutingRole" NOT NULL DEFAULT 'backup',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offer_domain_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "offer_domain_bindings_offer_id_custom_domain_id_key"
  ON "offer_domain_bindings"("offer_id", "custom_domain_id");
CREATE INDEX IF NOT EXISTS "offer_domain_bindings_user_id_offer_id_is_active_idx"
  ON "offer_domain_bindings"("user_id", "offer_id", "is_active");
CREATE INDEX IF NOT EXISTS "offer_domain_bindings_custom_domain_id_idx"
  ON "offer_domain_bindings"("custom_domain_id");

DO $$ BEGIN
  ALTER TABLE "offer_domain_bindings"
    ADD CONSTRAINT "offer_domain_bindings_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "offer_domain_bindings"
    ADD CONSTRAINT "offer_domain_bindings_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "offer_domain_bindings"
    ADD CONSTRAINT "offer_domain_bindings_custom_domain_id_fkey"
    FOREIGN KEY ("custom_domain_id") REFERENCES "custom_domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================
-- 7) Tabela domain_routing_events
-- ========================
CREATE TABLE IF NOT EXISTS "domain_routing_events" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "event_type" "DomainRoutingEventType" NOT NULL,
  "scope" VARCHAR(32) NOT NULL DEFAULT 'domain',
  "custom_domain_id" TEXT,
  "previous_domain_id" TEXT,
  "target_domain_id" TEXT,
  "presell_id" TEXT,
  "offer_id" TEXT,
  "actor_user_id" TEXT,
  "reason" VARCHAR(500),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "domain_routing_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "domain_routing_events_user_id_created_at_idx"
  ON "domain_routing_events"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "domain_routing_events_custom_domain_id_created_at_idx"
  ON "domain_routing_events"("custom_domain_id", "created_at");
CREATE INDEX IF NOT EXISTS "domain_routing_events_presell_id_created_at_idx"
  ON "domain_routing_events"("presell_id", "created_at");
CREATE INDEX IF NOT EXISTS "domain_routing_events_offer_id_created_at_idx"
  ON "domain_routing_events"("offer_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "domain_routing_events"
    ADD CONSTRAINT "domain_routing_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "domain_routing_events"
    ADD CONSTRAINT "domain_routing_events_custom_domain_id_fkey"
    FOREIGN KEY ("custom_domain_id") REFERENCES "custom_domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "domain_routing_events"
    ADD CONSTRAINT "domain_routing_events_previous_domain_id_fkey"
    FOREIGN KEY ("previous_domain_id") REFERENCES "custom_domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "domain_routing_events"
    ADD CONSTRAINT "domain_routing_events_target_domain_id_fkey"
    FOREIGN KEY ("target_domain_id") REFERENCES "custom_domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "domain_routing_events"
    ADD CONSTRAINT "domain_routing_events_presell_id_fkey"
    FOREIGN KEY ("presell_id") REFERENCES "presell_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "domain_routing_events"
    ADD CONSTRAINT "domain_routing_events_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ========================
-- 8) Backfill seguro e não destrutivo
-- ========================

-- 8a) Papéis e saúde inicial dos domínios existentes
UPDATE "custom_domains"
SET
  "routing_role" = 'primary'::"DomainRoutingRole",
  "routing_priority" = 10
WHERE "status" = 'verified'
  AND ("is_default" = true OR ("purpose" = 'tracking' AND "is_default_tracking" = true));

-- Restantes domínios ficam em 'standby': o papel 'backup' (alvo de failover automático) é opt-in explícito.

UPDATE "custom_domains"
SET "health_status" = 'healthy'::"DomainHealthStatus"
WHERE "status" = 'verified'
  AND "https_reachable_cached" = true
  AND "health_status" = 'unknown'::"DomainHealthStatus";

-- 8b) Extrair ofertas únicas de presell_pages (sem alterar content/tracking legados)
WITH presell_legacy_offers AS (
  SELECT
    pp."user_id",
    BTRIM(
      COALESCE(
        NULLIF(BTRIM(pp."content"->>'affiliateLink'), ''),
        NULLIF(BTRIM(pp."content"->>'affiliate_link'), ''),
        NULLIF(BTRIM(pp."tracking"->>'offerUrl'), ''),
        NULLIF(BTRIM(pp."tracking"->>'offer_url'), '')
      )
    ) AS hoplink_url,
    COALESCE(NULLIF(BTRIM(pp."title"), ''), 'Oferta importada') AS offer_name,
    MAX(ac."platform") AS network_hint,
    MIN(pp."created_at") AS first_seen_at
  FROM "presell_pages" pp
  LEFT JOIN "affiliate_campaigns" ac
    ON ac."presell_id" = pp."id" AND ac."user_id" = pp."user_id"
  GROUP BY 1, 2, 3
),
valid_presell_offers AS (
  SELECT DISTINCT ON ("user_id", hoplink_url)
    "user_id",
    hoplink_url,
    LEFT(offer_name, 200) AS offer_name,
    NULLIF(BTRIM(network_hint), '') AS network_hint,
    first_seen_at
  FROM presell_legacy_offers
  WHERE hoplink_url ~* '^https?://'
    AND hoplink_url <> '#'
  ORDER BY "user_id", hoplink_url, first_seen_at ASC
)
INSERT INTO "offers" (
  "id",
  "user_id",
  "name",
  "network",
  "hoplink_url",
  "validation_status",
  "compliance_passed",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  v."user_id",
  v.offer_name,
  v.network_hint,
  v.hoplink_url,
  'unchecked'::"OfferValidationStatus",
  false,
  true,
  v.first_seen_at,
  NOW()
FROM valid_presell_offers v
WHERE NOT EXISTS (
  SELECT 1 FROM "offers" o
  WHERE o."user_id" = v."user_id" AND o."hoplink_url" = v.hoplink_url
);

-- 8c) Extrair ofertas de affiliate_campaigns quando offer_url não existe ainda em offers
WITH camp_offers AS (
  SELECT DISTINCT ON ("user_id", BTRIM("offer_url"))
    "user_id",
    BTRIM("offer_url") AS hoplink_url,
    LEFT(COALESCE(NULLIF(BTRIM("name"), ''), 'Oferta de campanha'), 200) AS offer_name,
    NULLIF(BTRIM("platform"), '') AS network_hint,
    "created_at"
  FROM "affiliate_campaigns"
  WHERE "offer_url" IS NOT NULL
    AND BTRIM("offer_url") ~* '^https?://'
  ORDER BY "user_id", BTRIM("offer_url"), "created_at" ASC
)
INSERT INTO "offers" (
  "id",
  "user_id",
  "name",
  "network",
  "hoplink_url",
  "validation_status",
  "compliance_passed",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  c."user_id",
  c.offer_name,
  c.network_hint,
  c.hoplink_url,
  'unchecked'::"OfferValidationStatus",
  false,
  true,
  c."created_at",
  NOW()
FROM camp_offers c
WHERE NOT EXISTS (
  SELECT 1 FROM "offers" o
  WHERE o."user_id" = c."user_id" AND o."hoplink_url" = c.hoplink_url
);

-- 8d) Ligar presell_pages.offer_id às ofertas extraídas (sem tocar nos campos legados)
UPDATE "presell_pages" pp
SET "offer_id" = o."id"
FROM "offers" o
WHERE pp."offer_id" IS NULL
  AND o."user_id" = pp."user_id"
  AND o."hoplink_url" = BTRIM(
    COALESCE(
      NULLIF(BTRIM(pp."content"->>'affiliateLink'), ''),
      NULLIF(BTRIM(pp."content"->>'affiliate_link'), ''),
      NULLIF(BTRIM(pp."tracking"->>'offerUrl'), ''),
      NULLIF(BTRIM(pp."tracking"->>'offer_url'), '')
    )
  );

-- 8e) Ligar affiliate_campaigns.offer_id às ofertas extraídas ou via presell ligada
UPDATE "affiliate_campaigns" ac
SET "offer_id" = o."id"
FROM "offers" o
WHERE ac."offer_id" IS NULL
  AND ac."offer_url" IS NOT NULL
  AND o."user_id" = ac."user_id"
  AND o."hoplink_url" = BTRIM(ac."offer_url");

UPDATE "affiliate_campaigns" ac
SET "offer_id" = pp."offer_id"
FROM "presell_pages" pp
WHERE ac."offer_id" IS NULL
  AND ac."presell_id" = pp."id"
  AND ac."user_id" = pp."user_id"
  AND pp."offer_id" IS NOT NULL;

-- 8f) Backfill de presell_domain_bindings apenas para presells com domínio explícito (custom_domain_id).
-- Presells com custom_domain_id NULL seguem o domínio default da conta e não recebem binding,
-- para não congelar o default atual.
WITH primary_domain_per_presell AS (
  SELECT
    pp."id" AS presell_id,
    pp."user_id",
    cd."id" AS chosen_domain_id
  FROM "presell_pages" pp
  JOIN "custom_domains" cd
    ON cd."id" = pp."custom_domain_id"
   AND cd."user_id" = pp."user_id"
   AND cd."status" = 'verified'::"CustomDomainStatus"
   AND cd."purpose" <> 'tracking'::"CustomDomainPurpose"
)
INSERT INTO "presell_domain_bindings" (
  "id",
  "user_id",
  "presell_id",
  "custom_domain_id",
  "role",
  "priority",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  p."user_id",
  p.presell_id,
  p.chosen_domain_id,
  'primary'::"DomainRoutingRole",
  10,
  true,
  NOW(),
  NOW()
FROM primary_domain_per_presell p
WHERE p.chosen_domain_id IS NOT NULL
ON CONFLICT ("presell_id", "custom_domain_id") DO NOTHING;
