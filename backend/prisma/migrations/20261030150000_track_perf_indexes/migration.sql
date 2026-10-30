-- A10 / analytics: Subscription.planId + TrackingEvent composites + gclid expression index

CREATE INDEX IF NOT EXISTS "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");

CREATE INDEX IF NOT EXISTS "tracking_events_user_id_created_at_idx" ON "tracking_events"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "tracking_events_user_id_event_type_ip_address_created_at_idx"
  ON "tracking_events"("user_id", "event_type", "ip_address", "created_at");

-- Expressão: lookups CSV / offline por gclid em metadata JSON
CREATE INDEX IF NOT EXISTS "tracking_events_metadata_gclid_idx"
  ON "tracking_events" ((metadata->>'gclid'))
  WHERE metadata->>'gclid' IS NOT NULL AND metadata->>'gclid' <> '';

CREATE INDEX IF NOT EXISTS "tracking_events_metadata_transaction_id_idx"
  ON "tracking_events" ((metadata->>'transaction_id'))
  WHERE metadata->>'transaction_id' IS NOT NULL AND metadata->>'transaction_id' <> '';
