-- Convites por link (uso único) para juntar membros ao workspace
CREATE TABLE "organization_invites" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" "AppRole" NOT NULL DEFAULT 'member',
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "used_at" TIMESTAMP(3),
    "used_by_user_id" UUID,
    "email_constraint" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_invites_token_key" ON "organization_invites"("token");
CREATE INDEX "organization_invites_organization_id_idx" ON "organization_invites"("organization_id");
CREATE INDEX "organization_invites_token_idx" ON "organization_invites"("token");

ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_used_by_user_id_fkey" FOREIGN KEY ("used_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
