FROM node:24-bookworm-slim AS build
WORKDIR /rocket
COPY experiments/rocket-arena-lab/package.json experiments/rocket-arena-lab/package-lock.json ./
COPY experiments/rocket-arena-lab/shared/package.json shared/package.json
COPY experiments/rocket-arena-lab/simulation/package.json simulation/package.json
COPY experiments/rocket-arena-lab/server/package.json server/package.json
COPY experiments/rocket-arena-lab/client/package.json client/package.json
RUN npm ci
COPY experiments/rocket-arena-lab/ .
COPY packages/observability/src/logger.ts /rocket/.build/shared-logger.ts
COPY apps/game-server/src/gameVoiceToken.ts /rocket/.build/game-voice-token.ts
RUN node scripts/build-app.mjs /rocket/.build/shared-logger.ts /rocket/.build/game-voice-token.ts

FROM node:24-bookworm-slim AS runtime
WORKDIR /rocket
ENV NODE_ENV=production HOST=0.0.0.0 ROCKET_MODE=app ROCKET_ARENA_DEV_CONTROLS=false
COPY experiments/rocket-arena-lab/package.json experiments/rocket-arena-lab/package-lock.json ./
COPY experiments/rocket-arena-lab/shared/package.json shared/package.json
COPY experiments/rocket-arena-lab/simulation/package.json simulation/package.json
COPY experiments/rocket-arena-lab/server/package.json server/package.json
COPY experiments/rocket-arena-lab/client/package.json client/package.json
RUN npm ci --omit=dev --workspace=@rocket-arena/server --include-workspace-root=false && npm cache clean --force
COPY --from=build /rocket/shared/dist shared/dist
COPY --from=build /rocket/simulation/dist simulation/dist
COPY --from=build /rocket/server/dist server/dist
COPY --from=build /rocket/client/dist client/dist
COPY experiments/rocket-arena-lab/LICENSE LICENSE
USER node
CMD ["node", "server/dist/index.js"]
