# API Clickora (backend) — Railway usa este ficheiro quando existe na raiz do repo.
FROM node:22-bookworm-slim AS base
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci

COPY backend ./backend

RUN cd backend && npm run build

ENV NODE_ENV=production
WORKDIR /app/backend
EXPOSE 3001

# Migrações na base em cada arranque (Railway já tem DATABASE_URL). Sem passo manual.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/server.js"]
