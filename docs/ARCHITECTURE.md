# DevArena — Repository Architecture

This document explains what lives where and why. Feature-level design
belongs in the SDD; this file covers the monorepo foundation only.

## Layout

```
devarena/
├── apps/                  Deployable user-facing applications
│   ├── frontend/          React 19 + Vite SPA (Monaco, Redux, React Query)
│   └── backend/           Express API + Socket.IO gateway + Prisma
├── packages/              Internal libraries (never deployed alone)
│   ├── shared-types/      Type contracts shared by client & services
│   ├── shared-utils/      Framework-agnostic helpers (env validation…)
│   ├── eslint-config/     One lint ruleset, three flavors (base/node/react)
│   └── ts-config/         One compiler baseline, extended per target
├── services/              Independently scalable backend workers
│   ├── execution-engine/  BullMQ worker → future Docker sandbox runner
│   └── ai-service/        Internal wrapper around Gemini (hints, review)
├── docker/                Infra configs that belong to no single app (NGINX)
├── docs/                  Architecture and design documents
├── scripts/               Repo automation (setup, future db seeds)
└── .github/workflows/     CI pipelines
```

## Principles

1. **apps vs services vs packages** — `apps` face users, `services`
   face queues/internal HTTP and scale independently, `packages` are
   code reuse only. This keeps deployment units obvious.
2. **Config is code-reviewed once** — tsconfig/eslint live in
   `packages/*` and are extended everywhere, so drift between projects
   is impossible.
3. **Fail-fast configuration** — every process validates its
   environment with Zod at boot (`src/config/env.ts`). A missing var
   crashes startup, never a request.
4. **App factory pattern** — `createApp()` is separate from
   `listen()`, so integration tests import the app without a port.
5. **Root-context Dockerfiles** — all images build from the repo root
   so pnpm workspace links resolve; each is multi-stage and runs as a
   non-root user.

## Local workflows

| Task                     | Command                                                |
| ------------------------ | ------------------------------------------------------ |
| First-time setup         | `bash scripts/setup.sh`                                |
| Dev servers (FE+BE)      | `pnpm dev`                                             |
| Full stack in Docker     | `docker compose up -d --build` → http://localhost:8080 |
| Lint / typecheck / build | `pnpm lint` / `pnpm typecheck` / `pnpm build`          |
