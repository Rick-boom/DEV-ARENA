# Multi-stage build: pnpm workspace-aware, small runtime image,
# non-root user. Context must be the repo root.
# Build: docker build -f apps/backend/Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# ── Install deps (cached until lockfile changes) ────────────────
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/backend/package.json ./apps/backend/
RUN pnpm install --frozen-lockfile=false --filter @devarena/backend...

# ── Build ───────────────────────────────────────────────────────
FROM deps AS build
COPY apps/backend ./apps/backend
RUN pnpm --filter @devarena/shared-types build \
 && pnpm --filter @devarena/shared-utils build \
 && pnpm --filter @devarena/backend prisma:generate \
 && pnpm --filter @devarena/backend build

# ── Runtime ─────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
WORKDIR /repo
COPY --from=build /repo ./
USER app
EXPOSE 4000
CMD ["node", "apps/backend/dist/index.js"]
