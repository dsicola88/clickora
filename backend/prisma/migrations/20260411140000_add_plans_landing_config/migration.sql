-- CreateTable: PlansLandingConfig (estava no schema mas sem migração — seed falhava com P2021)
CREATE TABLE "plans_landing_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "badge_text" TEXT,
    "hero_title" TEXT NOT NULL DEFAULT 'Escolha seu plano',
    "hero_subtitle" TEXT,
    "hero_image_ext" TEXT,
    "hero_image_mime" TEXT,
    "intro_text" TEXT,
    "footer_text" TEXT,
    "hero_font" TEXT NOT NULL DEFAULT 'sans',
    "hero_text_align" TEXT NOT NULL DEFAULT 'left',
    "hero_title_size" TEXT NOT NULL DEFAULT '3xl',
    "hero_title_weight" TEXT NOT NULL DEFAULT 'bold',
    "hero_subtitle_size" TEXT NOT NULL DEFAULT 'base',
    "intro_font" TEXT NOT NULL DEFAULT 'sans',
    "intro_text_align" TEXT NOT NULL DEFAULT 'left',
    "intro_text_size" TEXT NOT NULL DEFAULT 'base',
    "footer_font" TEXT NOT NULL DEFAULT 'sans',
    "footer_text_align" TEXT NOT NULL DEFAULT 'center',
    "footer_text_size" TEXT NOT NULL DEFAULT 'sm',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_landing_config_pkey" PRIMARY KEY ("id")
);
