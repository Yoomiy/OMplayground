# syntax=docker/dockerfile:1
# A clean checkout restores the checked-in, source-matched Wasm release.
FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
COPY . ./
RUN npm ci --workspace @playground/voxel-server --workspace @playground/game-logic --workspace @playground/observability --include-workspace-root=false --ignore-scripts --no-audit --no-fund \
    && npm ci --prefix games/voxel --ignore-scripts --no-audit --no-fund
RUN node games/voxel/tools/release-snapshot.mjs restore \
    && npm run build --workspace @playground/game-logic \
    && npm run build --workspace @playground/observability \
    && node apps/voxel-server/tools/package-release.ts

FROM node:24.21.0-bookworm-slim AS dependencies
WORKDIR /app
COPY --from=build /app/apps/voxel-server/dist/runtime/ ./
RUN npm ci --workspace @playground/voxel-server --workspace @playground/game-logic --workspace @playground/observability --include-workspace-root=false --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm ci --prefix games/voxel --omit=dev --ignore-scripts --no-audit --no-fund \
    && node verify-runtime.mjs

FROM node:24.21.0-bookworm-slim
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/ ./
ENV NODE_ENV=production
ENV PORT=3001
ENV VOXEL_HOST=0.0.0.0
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "healthcheck.mjs"]
CMD ["node", "apps/voxel-server/src/index.ts"]
