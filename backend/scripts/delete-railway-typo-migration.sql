-- Remove registo de migrações «fantasma» na BD (não existem em prisma/migrations no Git).
-- Só correr se `prisma migrate resolve --rolled-back` falhar.
-- Variantes já vistas na Railway: typo meta_copi + timestamp 30800 meta_capi.
DELETE FROM "_prisma_migrations"
WHERE migration_name IN (
  '20240417130000_meta_copi_integration',
  '20240417130800_meta_capi_integration'
);
