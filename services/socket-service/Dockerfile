# ── Socket service image ────────────────────────────────────────────
# Multi-stage: build TS in a full image, ship dist + prod deps only.
# Stateless: scale by running N replicas behind a sticky-session LB;
# the Redis adapter makes them one logical Socket.IO server.
FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY services/socket-service ./services/socket-service
RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @devarena/shared-types build \
 && pnpm --filter @devarena/shared-utils build \
 && pnpm --filter @devarena/socket-service build

FROM node:22-slim AS runtime
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY --from=build /repo/services/socket-service/dist ./dist
COPY --from=build /repo/services/socket-service/package.json ./
COPY --from=build /repo/node_modules ./node_modules
EXPOSE 4100
CMD ["node", "dist/index.js"]
