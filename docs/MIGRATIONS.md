# DevArena — Migration Strategy

Prisma Migrate owns the schema lifecycle. Raw SQL in migrations is
allowed (and sometimes required — see partial indexes below), but the
schema.prisma file is always the source of truth for shape.

## Folder structure

```
apps/backend/prisma/
├── schema.prisma                # source of truth
├── seed.ts                      # idempotent seed (upserts)
└── migrations/
    ├── migration_lock.toml      # provider lock — committed
    └── <timestamp>_<name>/      # generated per migration
        └── migration.sql
```

## Creating the initial migration

Prisma generates migration SQL deterministically from the schema, so
the SQL is produced on a machine with DB access rather than written by
hand (hand-written SQL drifts from what `migrate dev` expects):

```bash
docker compose up -d postgres
pnpm --filter @devarena/backend db:migrate -- --name init
pnpm --filter @devarena/backend db:seed
```

Commit the generated `prisma/migrations/<ts>_init/` directory. From
then on every schema change follows the same loop: edit
`schema.prisma` → `db:migrate -- --name <change>` → commit both files
together in one PR.

## Naming conventions

`<verb>_<subject>`, snake_case, imperative, scoped to one concern:

- `init`
- `add_problem_companies`
- `add_index_submissions_battle`
- `alter_user_bio_length`

One logical change per migration. Never edit an applied migration —
additive fixes go in a new migration.

## Environments

| Env        | Command                                                                        | Behavior                                                       |
| ---------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Local dev  | `prisma migrate dev`                                                           | Creates + applies + regenerates client; may prompt to reset    |
| CI         | `prisma migrate deploy`                                                        | Applies pending migrations only, non-interactive, fails loudly |
| Production | `prisma migrate deploy` in the release step, before the new app version starts | Never `migrate dev`, never `db push`                           |

## Rollback strategy

Prisma has no automatic down-migrations, which is the honest position
for production databases — reverse SQL that was never tested against
real data is more dangerous than a forward fix. The policy:

1. **Roll forward by default.** Write a new migration that reverses or
   repairs the change (`drop_index_x`, `restore_column_y`).
2. **Expand → migrate → contract** for anything touching live traffic:
   add the new nullable column/table first (deploy N), backfill and
   dual-write (deploy N+1), remove the old shape (deploy N+2). No
   deploy ever requires the previous app version to break.
3. **Failed mid-apply migration:** `prisma migrate resolve
--rolled-back <name>` marks it rolled back after you manually
   restore state, then fix and re-issue.
4. **Disaster case:** restore from the point-in-time backup (managed
   Postgres PITR), then `migrate deploy` to the known-good marker.

## Zero-downtime rules

- New columns are nullable or defaulted; `NOT NULL` is added in the
  contract step after backfill.
- Index creation on large tables uses raw
  `CREATE INDEX CONCURRENTLY` in the migration SQL (Prisma allows
  editing the generated file before applying — mark such migrations
  and run them outside a transaction).
- Enum value additions are safe; removals/renames follow
  expand-contract.

## Partial-index note (soft deletes)

`@@index([deletedAt])` serves the common `WHERE "deletedAt" IS NULL`
filter. Once tables grow, replace with true partial indexes in a raw
migration for a smaller/hotter index, e.g.:

```sql
CREATE INDEX CONCURRENTLY "users_live_rating_idx"
  ON "users" ("rating" DESC) WHERE "deletedAt" IS NULL;
```
