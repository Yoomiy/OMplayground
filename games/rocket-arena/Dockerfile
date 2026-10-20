FROM node:24-bookworm-slim AS build
WORKDIR /rocket
COPY games/rocket-arena/package.json games/rocket-arena/package-lock.json ./
COPY games/rocket-arena/shared/package.json shared/package.json
COPY games/rocket-arena/simulation/package.json simulation/package.json
COPY games/rocket-arena/server/package.json server/package.json
COPY games/rocket-arena/client/package.json client/package.json
RUN npm ci
COPY games/rocket-arena/ .
COPY packages/observability/src/logger.ts /rocket/.build/shared-logger.ts
COPY apps/game-server/src/gameVoiceToken.ts /rocket/.build/game-voice-token.ts
RUN node scripts/build-app.mjs /rocket/.build/shared-logger.ts /rocket/.build/game-voice-token.ts

FROM node:24-bookworm-slim AS runtime
WORKDIR /rocket
ENV NODE_ENV=production HOST=0.0.0.0
COPY games/rocket-arena/package.json games/rocket-arena/package-lock.json ./
COPY games/rocket-arena/shared/package.json shared/package.json
COPY games/rocket-arena/simulation/package.json simulation/package.json
COPY games/rocket-arena/server/package.json server/package.json
COPY games/rocket-arena/client/package.json client/package.json
RUN npm ci --omit=dev --workspace=@rocket-arena/server --include-workspace-root=false && npm cache clean --force
COPY --from=build /rocket/shared/dist shared/dist
COPY --from=build /rocket/simulation/dist simulation/dist
COPY --from=build /rocket/server/dist server/dist
COPY --from=build /rocket/client/dist client/dist
# Type-check regression tests during build; ship only runtime modules.
RUN find server/dist -type f \( -name '*.test.*' -o -name 'test-*' \) -delete
COPY games/rocket-arena/LICENSE LICENSE
USER node
CMD ["node", "server/dist/index.js"]
