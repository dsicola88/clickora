-- CreateTable
CREATE TABLE "site_branding" (
    "id" TEXT NOT NULL,
    "favicon_ext" TEXT,
    "favicon_mime" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_branding_pkey" PRIMARY KEY ("id")
);
