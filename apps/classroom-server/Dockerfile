FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/classroom-server/package.json apps/classroom-server/package.json
COPY packages/observability/package.json packages/observability/package.json
RUN npm ci --workspace @playground/classroom-server --workspace @playground/observability --include-workspace-root=false --ignore-scripts
COPY packages/observability/src packages/observability/src
COPY packages/observability/tsconfig.json packages/observability/tsconfig.json
COPY apps/classroom-server/src apps/classroom-server/src
COPY apps/classroom-server/tsconfig.json apps/classroom-server/tsconfig.json
RUN npm run build --workspace @playground/classroom-server

FROM node:24.21.0-bookworm-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/observability/package.json ./packages/observability/package.json
COPY --from=build /app/packages/observability/dist ./packages/observability/dist
COPY --from=build /app/apps/classroom-server/package.json ./apps/classroom-server/package.json
COPY --from=build /app/apps/classroom-server/dist ./apps/classroom-server/dist
ENV NODE_ENV=production
ENV PORT=8083
EXPOSE 8083
CMD ["node", "apps/classroom-server/dist/index.js"]
