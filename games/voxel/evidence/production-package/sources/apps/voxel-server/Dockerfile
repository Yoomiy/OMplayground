# syntax=docker/dockerfile:1
# Build the matching release first: npm run package:voxel-server
FROM node:24.21.0-bookworm-slim AS dependencies
WORKDIR /app
COPY apps/voxel-server/dist/runtime/ ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --workspace @playground/voxel-server --workspace @playground/game-logic --workspace @playground/observability --include-workspace-root=false --omit=dev --ignore-scripts --no-audit --no-fund \
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
