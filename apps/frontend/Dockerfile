# Build the static bundle with pnpm, serve it with NGINX.
# Context must be the repo root.
# Build: docker build -f apps/frontend/Dockerfile .

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/frontend/package.json ./apps/frontend/
RUN pnpm install --frozen-lockfile=false --filter @devarena/frontend...
COPY apps/frontend ./apps/frontend
RUN pnpm --filter @devarena/shared-types build \
 && pnpm --filter @devarena/frontend build

FROM nginx:1.27-alpine AS runtime
COPY docker/nginx/frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
