-- Segredo opcional por conta para validar o cverify da JVZoo. Não apaga dados.
ALTER TABLE "users" ADD COLUMN "jvzoo_ipn_secret" TEXT;
