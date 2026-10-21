FROM node:24-bookworm-slim AS build
WORKDIR /repo/games/wobble-rush
COPY games/wobble-rush/package.json games/wobble-rush/package-lock.json ./
RUN npm ci
COPY games/wobble-rush/ .
COPY packages/observability/src/logger.ts packages/observability/src/error.ts packages/observability/src/processLifecycle.ts /repo/packages/observability/src/
COPY apps/game-server/src/gameVoiceToken.ts /repo/apps/game-server/src/gameVoiceToken.ts
COPY packages/game-logic/src/recessSchedule.ts /repo/packages/game-logic/src/recessSchedule.ts
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /wobble
ENV NODE_ENV=production HOST=0.0.0.0
COPY games/wobble-rush/package.json games/wobble-rush/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /repo/games/wobble-rush/dist dist
COPY games/wobble-rush/LICENSE LICENSE
USER node
CMD ["node", "dist/server.mjs"]
