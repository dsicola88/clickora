# API Clickora (backend) — Railway usa este ficheiro quando o Root Directory do serviço é a RAIZ do repo.
# Se o Root Directory for «backend/», usa-se em vez disso backend/Dockerfile (+ backend/railway.toml).
FROM node:22-bookworm-slim AS base
# Prisma precisa de OpenSSL detetável (evita aviso libssl e falhas intermitentes na slim)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci
# Chromium para importar presells de landings que montam o hero em JavaScript (primeira dobra real).
RUN cd backend && npx playwright install --with-deps chromium

COPY backend ./backend

RUN chmod +x /app/backend/scripts/start-production.sh

RUN cd backend && npm run build

ENV NODE_ENV=production
WORKDIR /app/backend
EXPOSE 3001

# Migrações em cada arranque; seed só com RUN_SEED_ON_START=true (ver start-production.sh)
CMD ["sh", "/app/backend/scripts/start-production.sh"]
