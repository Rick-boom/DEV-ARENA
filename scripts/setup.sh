#!/usr/bin/env bash
# One-command local bootstrap for a fresh clone.
set -euo pipefail

echo "▶ DevArena setup"

command -v pnpm >/dev/null || { echo "pnpm is required (corepack enable)"; exit 1; }

echo "▶ Installing workspace dependencies"
pnpm install

echo "▶ Copying .env.example files (skips existing .env)"
for dir in apps/backend apps/frontend services/execution-engine services/ai-service; do
  if [ ! -f "$dir/.env" ]; then
    cp "$dir/.env.example" "$dir/.env"
    echo "  created $dir/.env"
  fi
done

echo "▶ Building shared packages"
pnpm --filter @devarena/shared-types build
pnpm --filter @devarena/shared-utils build

echo "▶ Generating Prisma client"
pnpm --filter @devarena/backend prisma:generate

echo "✔ Done. Next:"
echo "   docker compose up -d postgres redis   # start data stores"
echo "   pnpm dev                              # run frontend + backend"
