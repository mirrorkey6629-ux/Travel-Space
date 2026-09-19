# syntax=docker/dockerfile:1

# Один образ обслуживает и собранный SPA, и API: под базовым путём /travel
# Fastify отдаёт статику, под /travel/api — свои маршруты.

ARG NODE_IMAGE=node:22-alpine
# Глобальный ARG: базовый путь нужен и на сборке SPA, и в рантайме API,
# иначе они разъедутся при сборке с нестандартным префиксом.
ARG BASE_PATH=/travel

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Без этого corepack в неинтерактивной сборке ждёт подтверждения загрузки pnpm.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# Манифесты копируются отдельным слоем, чтобы установка зависимостей
# переиспользовалась из кеша, пока меняются только исходники.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
# Префикс вшивается в бандл на этапе сборки: Vite подставляет его в пути к
# ассетам и в import.meta.env.BASE_URL, поменять его в готовом образе нельзя.
ARG BASE_PATH
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_GOOGLE_MAPS_MAP_ID
ENV BASE_PATH=${BASE_PATH}
ENV VITE_GOOGLE_MAPS_API_KEY=${VITE_GOOGLE_MAPS_API_KEY}
ENV VITE_GOOGLE_MAPS_MAP_ID=${VITE_GOOGLE_MAPS_MAP_ID}
COPY . .
# tsc -b внутри pnpm build падает на любой ошибке типов, поэтому непроходящий
# typecheck не даст собрать образ.
RUN pnpm build && pnpm build:api

# Отдельная установка без dev-зависимостей и без пакетов корневого workspace:
# в рантайме нужны только Fastify, pg и их транзитивные зависимости, а vite,
# react и typescript уже отработали на этапе сборки.
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @travel-planner/api

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Раскладка каталогов совпадает с репозиторием, поэтому символические ссылки
# pnpm из корневого node_modules остаются рабочими, а config.ts находит
# собранный SPA по относительному пути без дополнительных переменных.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/scripts/healthcheck.mjs ./apps/api/scripts/healthcheck.mjs
COPY --from=build /app/dist ./dist

# Каталог загрузок создаётся заранее и с нужным владельцем: смонтированный
# сюда named volume наследует права этого каталога при первом монтировании.
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data

ENV UPLOAD_DIR=/app/data/uploads
ENV API_HOST=0.0.0.0
ENV API_PORT=3000
# То же значение, что на сборке: API должен слушать ровно тот префикс,
# который вшит в бандл.
ARG BASE_PATH
ENV BASE_PATH=${BASE_PATH}

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "apps/api/scripts/healthcheck.mjs"]

# Сервер сам применяет миграции до открытия порта, отдельная команда не нужна.
CMD ["node", "apps/api/dist/server.js"]
