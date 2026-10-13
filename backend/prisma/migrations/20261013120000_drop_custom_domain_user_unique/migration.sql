-- O índice único por utilizador impedia o 2.º domínio mesmo quando o plano permite mais do que um.
-- A migração antiga só removia uma constraint com o mesmo nome, e o índice ficou.

DROP INDEX IF EXISTS "custom_domains_user_id_key";
