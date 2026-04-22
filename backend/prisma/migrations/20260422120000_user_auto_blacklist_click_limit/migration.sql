-- Limite de cliques por IP: após N cliques na janela, o IP é adicionado à blacklist automaticamente.
ALTER TABLE "users" ADD COLUMN "auto_blacklist_click_threshold" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "auto_blacklist_click_window_hours" INTEGER NOT NULL DEFAULT 24;
