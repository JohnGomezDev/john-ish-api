# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.19.0
ARG PNPM_VERSION=11.21.0

FROM node:${NODE_VERSION}-bookworm-slim AS base

ARG PNPM_VERSION

WORKDIR /usr/src/app

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV EMBEDDINGS_CACHE_DIR=/var/cache/johnish-api/embeddings

RUN mkdir -p /var/cache/johnish-api/embeddings \
    && chown -R node:node /var/cache/johnish-api /usr/src/app

COPY --chown=node:node package.json ./
COPY --chown=node:node --from=deps /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/dist ./dist
COPY --chown=node:node --chmod=755 docker/entrypoint.sh ./entrypoint.sh

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=600s --retries=5 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/docs').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./entrypoint.sh"]
