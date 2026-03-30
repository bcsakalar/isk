# ============================================================
# Stage 1: base — ortak katman
# ============================================================
FROM node:20-alpine AS base
WORKDIR /usr/src/app
RUN apk add --no-cache dumb-init && \
    addgroup -g 1001 -S nodejs && \
    adduser -S iskuser -u 1001 -G nodejs
COPY package.json package-lock.json* ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# ============================================================
# Stage 2: development — nodemon + tailwind watch
# ============================================================
FROM base AS development
ENV NODE_ENV=development
RUN npm install
COPY . .
RUN mkdir -p logs && chown -R iskuser:nodejs logs
USER iskuser
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]

# ============================================================
# Stage 3: build — tailwind CSS derlemesi (production için)
# ============================================================
FROM base AS build
RUN npm install
COPY . .
RUN npx tailwindcss -i ./client/css/tailwind.css -o ./client/css/output.css --minify

# ============================================================
# Stage 4: production — sadece production bağımlılıkları
# ============================================================
FROM base AS production
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm cache clean --force && \
    rm -rf /tmp/* /root/.npm
COPY --from=build /usr/src/app/server ./server/
COPY --from=build /usr/src/app/client ./client/
COPY --from=build /usr/src/app/admin ./admin/
RUN mkdir -p logs && chown -R iskuser:nodejs /usr/src/app
USER iskuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

ENTRYPOINT ["dumb-init", "./docker-entrypoint.sh"]
