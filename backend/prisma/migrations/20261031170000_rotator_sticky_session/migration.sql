-- Sticky session opcional nos rotadores (weighted/random).
ALTER TABLE "traffic_rotators" ADD COLUMN IF NOT EXISTS "sticky_session" BOOLEAN NOT NULL DEFAULT false;
