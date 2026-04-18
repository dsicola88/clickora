-- Remove registo da migração com typo (não existe em prisma/migrations no Git).
-- Só correr se `prisma migrate resolve --rolled-back` falhar.
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20240417130000_meta_copi_integration';
