# Context must be the repo root.
# Build: docker build -f services/ai-service/Dockerfile .

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY services/ai-service/package.json ./services/ai-service/
RUN pnpm install --frozen-lockfile=false --filter @devarena/ai-service...
COPY services/ai-service ./services/ai-service
RUN pnpm --filter @devarena/shared-types build \
 && pnpm --filter @devarena/shared-utils build \
 && pnpm --filter @devarena/ai-service build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
WORKDIR /repo
COPY --from=build /repo ./
USER app
EXPOSE 5000
CMD ["node", "services/ai-service/dist/index.js"]
