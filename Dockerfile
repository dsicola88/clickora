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

# Migrações + seed (utilizadores base) em cada arranque; depois a API.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && exec node dist/server.js"]
