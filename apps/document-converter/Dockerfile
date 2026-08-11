FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY apps/document-converter/package.json apps/document-converter/package.json
COPY apps/document-converter/tsconfig.json apps/document-converter/tsconfig.json
RUN npm ci --workspace @playground/document-converter --include-workspace-root --ignore-scripts
COPY apps/document-converter/src apps/document-converter/src
RUN npm run build -w @playground/document-converter

FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libreoffice-impress poppler-utils webp zip fontconfig \
    fonts-noto-core fonts-noto-extra fonts-liberation \
    fonts-crosextra-carlito fonts-crosextra-caladea \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/document-converter/package.json ./package.json
COPY --from=build /app/apps/document-converter/dist ./dist
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]
