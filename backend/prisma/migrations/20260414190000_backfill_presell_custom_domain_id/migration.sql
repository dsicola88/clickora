-- Preenche presell_pages.custom_domain_id em linhas antigas (NULL).
-- Por utilizador: domínio verificado com is_default = true; se vários, o mais antigo entre os default;
-- senão o verificado mais antigo (created_at).

UPDATE presell_pages pp
SET custom_domain_id = cd.id
FROM (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM custom_domains
  WHERE status = 'verified'
  ORDER BY user_id, is_default DESC, created_at ASC
) cd
WHERE pp.custom_domain_id IS NULL
  AND pp.user_id = cd.user_id;
