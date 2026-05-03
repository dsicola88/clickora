-- Rotadores de tráfego + braços (destinos), com modos random / weighted / sequential / fill_order.

CREATE TYPE "TrafficRotatorMode" AS ENUM ('random', 'weighted', 'sequential', 'fill_order');
CREATE TYPE "RotatorDeviceRule" AS ENUM ('all', 'mobile', 'desktop');

CREATE TABLE "traffic_rotators" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "mode" "TrafficRotatorMode" NOT NULL,
    "backup_url" TEXT,
    "context_presell_id" TEXT NOT NULL,
    "sequence_cursor" INTEGER NOT NULL DEFAULT 0,
    "access_code" VARCHAR(256),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traffic_rotators_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "traffic_rotator_arms" (
    "id" TEXT NOT NULL,
    "rotator_id" TEXT NOT NULL,
    "destination_url" TEXT NOT NULL,
    "label" TEXT,
    "order_index" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 100,
    "max_clicks" INTEGER,
    "clicks_delivered" INTEGER NOT NULL DEFAULT 0,
    "countries_allow" JSONB,
    "countries_deny" JSONB,
    "device_rule" "RotatorDeviceRule" NOT NULL DEFAULT 'all',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traffic_rotator_arms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "traffic_rotators_user_id_slug_key" ON "traffic_rotators"("user_id", "slug");
CREATE INDEX "traffic_rotators_user_id_idx" ON "traffic_rotators"("user_id");
CREATE INDEX "traffic_rotators_context_presell_id_idx" ON "traffic_rotators"("context_presell_id");
CREATE INDEX "traffic_rotator_arms_rotator_id_order_index_idx" ON "traffic_rotator_arms"("rotator_id", "order_index");

ALTER TABLE "traffic_rotators" ADD CONSTRAINT "traffic_rotators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "traffic_rotators" ADD CONSTRAINT "traffic_rotators_context_presell_id_fkey" FOREIGN KEY ("context_presell_id") REFERENCES "presell_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "traffic_rotator_arms" ADD CONSTRAINT "traffic_rotator_arms_rotator_id_fkey" FOREIGN KEY ("rotator_id") REFERENCES "traffic_rotators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Coluna esperada pelo schema workspace/routing (adicional ao rotador core); estava antes numa migração com timestamp anterior ao CREATE TABLE dos rotadores.
ALTER TABLE "traffic_rotators" ADD COLUMN "rules_policy" JSONB;
