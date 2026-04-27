-- Landings com tenant. Se a tabela ainda não existir (só `db push` em dev), cria com organização; senão, adiciona coluna e liga.
-- Tabela mãe: "Organization" (Prisma), não "organizations".

DO $$
BEGIN
  IF to_regclass('public.landing_pages') IS NULL THEN
    CREATE TABLE "landing_pages" (
        "id" UUID NOT NULL,
        "organization_id" UUID,
        "slug" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "is_published" BOOLEAN NOT NULL DEFAULT false,
        "document" JSONB NOT NULL DEFAULT '{}',
        "theme" JSONB,
        "updated_by_id" UUID,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "landing_pages_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "landing_pages_slug_key" ON "landing_pages"("slug");
    CREATE INDEX "landing_pages_is_published_slug_idx" ON "landing_pages"("is_published", "slug");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'landing_pages' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE "landing_pages" ADD COLUMN "organization_id" UUID;
  END IF;
END $$;

UPDATE "landing_pages" lp
SET "organization_id" = sub.id
FROM (
  SELECT o.id
  FROM "Organization" o
  ORDER BY o."created_at" ASC
  LIMIT 1
) AS sub
WHERE lp."organization_id" IS NULL;

DO $$
DECLARE
  c int;
BEGIN
  SELECT count(*)::int INTO c FROM "landing_pages" WHERE "organization_id" IS NULL;
  IF c > 0 THEN
    RAISE EXCEPTION 'landing_pages: não foi possível preencher organization_id (é necessária ≥1 organization na base).';
  END IF;
END $$;

ALTER TABLE "landing_pages" ALTER COLUMN "organization_id" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'landing_pages_organization_id_fkey') THEN
    ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'landing_pages_updated_by_id_fkey') THEN
    ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "landing_pages_organization_id_idx" ON "landing_pages"("organization_id");
