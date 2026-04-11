# API Clickora (backend) — Railway usa este ficheiro quando existe na raiz do repo.
FROM node:22-bookworm-slim AS base
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci

COPY backend ./backend

RUN chmod +x /app/backend/scripts/start-production.sh

RUN cd backend && npm run build

ENV NODE_ENV=production
WORKDIR /app/backend
EXPOSE 3001

# Migrações + seed em cada arranque; logs em start-production.sh
CMD ["sh", "/app/backend/scripts/start-production.sh"]
