-- Contas e-mail+senha podem manter password_hash; "só Google" têm null.
ALTER TABLE "User" ALTER COLUMN "password_hash" DROP NOT NULL;

-- Novo: identificador OpenID (Google) para login com Google
ALTER TABLE "User" ADD COLUMN "google_sub" TEXT;

CREATE UNIQUE INDEX "User_google_sub_key" ON "User"("google_sub");
