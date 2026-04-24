# API Clickora — usar quando o serviço Railway tem «Root Directory» = backend/
# (o Dockerfile na raiz do monorepo não entra neste caso.)
FROM node:22-bookworm-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
RUN npx playwright install --with-deps chromium

COPY . .
RUN chmod +x ./scripts/start-production.sh
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3001

CMD ["sh", "./scripts/start-production.sh"]
