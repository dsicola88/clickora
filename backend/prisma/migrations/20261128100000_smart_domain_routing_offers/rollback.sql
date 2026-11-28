-- Script de rollback reversível para 20261128100000_smart_domain_routing_offers
-- ATENÇÃO: Executar manualmente apenas se precisar reverter o schema da Etapa 1.
-- Os campos legados (presell_pages.content, presell_pages.tracking, presell_pages.custom_domain_id,
-- affiliate_campaigns.offer_url) foram preservados intactos.

ALTER TABLE "affiliate_campaigns" DROP CONSTRAINT IF EXISTS "affiliate_campaigns_offer_id_fkey";
DROP INDEX IF EXISTS "affiliate_campaigns_offer_id_idx";
ALTER TABLE "affiliate_campaigns" DROP COLUMN IF EXISTS "offer_id";

ALTER TABLE "presell_pages" DROP CONSTRAINT IF EXISTS "presell_pages_offer_id_fkey";
DROP INDEX IF EXISTS "presell_pages_offer_id_idx";
ALTER TABLE "presell_pages" DROP COLUMN IF EXISTS "offer_id";

DROP TABLE IF EXISTS "domain_routing_events";
DROP TABLE IF EXISTS "offer_domain_bindings";
DROP TABLE IF EXISTS "presell_domain_bindings";
DROP TABLE IF EXISTS "offers";

DROP INDEX IF EXISTS "custom_domains_user_id_is_active_health_status_idx";
ALTER TABLE "custom_domains"
  DROP COLUMN IF EXISTS "routing_priority",
  DROP COLUMN IF EXISTS "disabled_reason",
  DROP COLUMN IF EXISTS "is_active",
  DROP COLUMN IF EXISTS "auto_recover",
  DROP COLUMN IF EXISTS "consecutive_failures",
  DROP COLUMN IF EXISTS "last_http_status",
  DROP COLUMN IF EXISTS "last_health_error",
  DROP COLUMN IF EXISTS "last_health_check_at",
  DROP COLUMN IF EXISTS "health_status",
  DROP COLUMN IF EXISTS "routing_role";

DROP TYPE IF EXISTS "DomainRoutingEventType";
DROP TYPE IF EXISTS "OfferValidationStatus";
DROP TYPE IF EXISTS "DomainHealthStatus";
DROP TYPE IF EXISTS "DomainRoutingRole";
