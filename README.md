# DevArena

Real-time competitive programming platform — LeetCode-style problems,
Codeforces-style battles, Live Share-style collaboration, voice chat,
secure Docker execution and an AI coach.

**Status:** project foundation (monorepo, tooling, Docker, CI). No
feature logic is implemented yet — see `docs/ARCHITECTURE.md`.

## Quick start

```bash
corepack enable            # provides pnpm
bash scripts/setup.sh      # install deps, copy envs, build shared pkgs
docker compose up -d postgres redis
pnpm dev                   # frontend :5173, backend :4000
```

Full stack via Docker: `docker compose up -d --build` → http://localhost:8080

## Workspace map

| Path                        | Package                      | Purpose                        |
| --------------------------- | ---------------------------- | ------------------------------ |
| `apps/frontend`             | `@devarena/frontend`         | React 19 SPA                   |
| `apps/backend`              | `@devarena/backend`          | REST + WebSocket API           |
| `services/execution-engine` | `@devarena/execution-engine` | Sandboxed code runner (worker) |
| `services/ai-service`       | `@devarena/ai-service`       | Gemini wrapper                 |
| `packages/shared-types`     | `@devarena/shared-types`     | Shared TS contracts            |
| `packages/shared-utils`     | `@devarena/shared-utils`     | Env validation & helpers       |
| `packages/eslint-config`    | `@devarena/eslint-config`    | Shared lint rules              |
| `packages/ts-config`        | `@devarena/ts-config`        | Shared tsconfig bases          |

## Conventions

- Conventional Commits enforced by commitlint + Husky
- Prettier on staged files via lint-staged
- Every service validates env with Zod at boot (`src/config/env.ts`)
