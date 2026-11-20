# Imagem do app (planejamento S0 §6.5): Next standalone em Node 22.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
ARG GIT_SHA
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=1024
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# build = next build + cópia de static, public e drizzle para dentro do standalone
RUN npm run build && GIT_SHA="${GIT_SHA}" node scripts/resolve-sha.mjs

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_MANUAL_SIG_HANDLE=true
COPY --from=build --chown=node:node /app/.next/standalone ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]
