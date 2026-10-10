CREATE TABLE IF NOT EXISTS "academy_lessons" (
  "id" TEXT NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "provider" VARCHAR(16) NOT NULL,
  "source_url" TEXT NOT NULL,
  "video_id" VARCHAR(80) NOT NULL,
  "bunny_library_id" VARCHAR(16),
  "module_name" VARCHAR(80) NOT NULL DEFAULT 'Começar',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "academy_lessons_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "academy_lessons_published_module_name_sort_order_idx"
  ON "academy_lessons"("published", "module_name", "sort_order");
