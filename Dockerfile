# ---- base ----
FROM node:24-bookworm-slim AS base

# ---- deps ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Vendored Prisma engines (Prisma's own downloader is unreliable behind
# proxies; these are the exact binaries for prisma 6.19.3 / debian-openssl-3.0.x)
RUN cp docker/prisma-engines/schema-engine-debian-openssl-3.0.x \
      docker/prisma-engines/libquery_engine-debian-openssl-3.0.x.so.node \
      docker/prisma-engines/schema-engine-debian-openssl-3.0.x.sha256 \
      docker/prisma-engines/libquery_engine-debian-openssl-3.0.x.so.node.sha256 \
      node_modules/@prisma/engines/ \
 && cp docker/prisma-engines/libquery_engine-debian-openssl-3.0.x.so.node \
      node_modules/prisma/ \
 && chmod +x node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x
RUN npx prisma generate
RUN npm run build

# ---- runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh && mkdir -p /app/data /app/public/uploads
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
