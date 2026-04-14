-- Permite que vários custom_domains apontem a mesma presell em root_presell_id
-- (vários domínios com a mesma landing na raiz).
DROP INDEX IF EXISTS "custom_domains_root_presell_id_key";
