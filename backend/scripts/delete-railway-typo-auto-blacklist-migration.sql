-- Nome errado às vezes gravado na Railway (ano 202404 em vez de 202604).
-- Só correr se `prisma migrate resolve --rolled-back` não for suficiente.
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20240422120000_user_auto_blacklist_click_limit';
