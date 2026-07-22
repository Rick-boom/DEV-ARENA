# ── Execution service image (API or worker; CMD chosen at runtime) ──
# Multi-stage: build TS in a full image, ship only dist + prod deps.
# The WORKER variant needs the host Docker socket mounted at runtime
# (it launches sandbox containers); the API variant does not.
FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY services/execution-engine ./services/execution-engine
RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @devarena/shared-types build \
 && pnpm --filter @devarena/shared-utils build \
 && pnpm --filter @devarena/execution-engine build

FROM node:22-slim AS runtime
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY --from=build /repo/services/execution-engine/dist ./dist
COPY --from=build /repo/services/execution-engine/package.json ./
COPY --from=build /repo/node_modules ./node_modules
# Default to the worker; override CMD to ["node","dist/server.js"] for the API.
CMD ["node", "dist/index.js"]
