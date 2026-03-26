FROM oven/bun:1 AS build
WORKDIR /app

# Install deps
COPY package.json bun.lock* ./
COPY apps/ingest-service/package.json apps/ingest-service/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile --ignore-scripts

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/ingest-service/ apps/ingest-service/
COPY tsconfig.json .

# Production stage
FROM oven/bun:1-slim
WORKDIR /app

COPY package.json bun.lock* ./
COPY apps/ingest-service/package.json apps/ingest-service/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile --ignore-scripts --production

COPY --from=build /app/packages/shared packages/shared
COPY --from=build /app/apps/ingest-service apps/ingest-service
COPY tsconfig.json .

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:4000/health').then(r=>{if(!r.ok)process.exit(1)})"

CMD ["bun", "run", "apps/ingest-service/index.ts"]
