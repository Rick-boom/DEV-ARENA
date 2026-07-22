# DevArena — Database Design

PostgreSQL + Prisma. 27 models, 13 enums. Schema source of truth:
`apps/backend/prisma/schema.prisma` (every model carries a doc comment
explaining its purpose and every non-obvious field).

## ER Diagram (text)

```
                                ┌────────────┐
             ┌──────────────────│    User    │──────────────────┐
             │ 1:N              └─────┬──────┘              1:N │
             ▼                        │                         ▼
      ┌────────────┐    1:N ┌─────────┴────────┐ 1:N   ┌───────────────┐
      │  Session   │◄───────┤ (identity edges) ├──────►│    Account    │
      └────────────┘        └──────────────────┘       └───────────────┘

User 1:N ─► Submission ◄─ N:1 Problem          User 1:N ─► Notification
User 1:N ─► RatingHistory                      User 1:N ─► Activity
User 1:N ─► Analytics (unique per user+date)   User 1:N ─► AdminLog (actor)
User N:M ─► Achievement   via UserAchievement
User N:M ─► Problem       via Bookmark
User N:M ─► User          via FriendRequest (sender/receiver edges)

Problem 1:N ─► ProblemExample / ProblemConstraint / ProblemHint / TestCase
Problem 1:1 ─► ProblemEditorial
Problem N:M ─► Tag  via ProblemTag

Submission 1:N ─► SubmissionResult ◄─ N:1 TestCase
Submission N:1 ─► Battle (nullable — practice vs battle)

Room 1:1 ─► Battle
Room 1:N ─► RoomParticipant ◄─ N:1 User
Room N:1 ─► User (host)

Battle 1:N ─► BattleParticipant ◄─ N:1 User
Battle N:1 ─► Problem            Battle N:1 ─► User (winner, nullable)
Battle 1:N ─► RatingHistory

Leaderboard N:1 ─► User   (unique per scope+period+user)
```

## Why every relationship exists

**User → Session (1:N).** One human, many devices. Each row is one
refresh-token lineage; revoking a row logs out one device, revoking
all rows is "logout everywhere". Cascade: sessions are meaningless
without their user.

**User → Account (1:N).** A user may link Google _and_ GitHub. The
`(provider, providerAccountId)` unique guarantees an external identity
can never map to two DevArena users — the invariant OAuth login
depends on.

**User → Problem as author (1:N, SetNull).** Attribution, not
ownership. If an author leaves, the problem survives with `authorId =
NULL` rather than cascading away platform content.

**Problem → Example/Constraint/Hint (1:N, Cascade).** Statement
sub-documents. Rows instead of one JSON blob because each is
individually ordered (`unique(problemId, order)` prevents duplicate
positions), individually editable in the admin panel, and hints must
be revealable one at a time.

**Problem → Editorial (1:1).** Enforced by `@unique` on `problemId`.
A problem has exactly one official solution; splitting it out keeps
the heavy editorial text off the hot problem-list query path.

**Problem ↔ Tag via ProblemTag (N:M).** A problem has many tags, a
tag has many problems. The join is explicit so `tagId` is indexed
("all DP problems" is an index scan) and so weight/metadata can be
added later without restructuring.

**Problem → TestCase (1:N).** The judge's inputs. `isHidden` splits
samples from the private set; the `(problemId, isHidden)` index is
exactly the judge's read pattern.

**User/Problem → Submission (1:N, Restrict).** The system's core
fact table. `Restrict` + soft delete on the parents means history can
never dangle: users and problems are soft-deleted precisely because
submissions must outlive them.

**Submission → SubmissionResult ← TestCase.** Per-test verdicts.
`unique(submissionId, testCaseId)` = one verdict per test per run;
separate table so the UI can stream results and the submission row
stays narrow.

**Submission → Battle (N:1, nullable, SetNull).** One judging
pipeline serves practice and battles; a battle submission is just a
submission with a battle pointer. SetNull keeps the submission as
practice history even if a battle record is purged.

**Room → RoomParticipant ← User.** Membership with join/leave
timestamps. The `unique(roomId, userId)` constraint is the DB-level
guard against double-join races from the socket layer.

**Room → Battle (1:1).** A battle is the competitive payload of a
BATTLE-type room. 1:1 (unique `roomId`) keeps room lifecycle
(lobby/presence) and match lifecycle (scoring/rating) separately
modeled but rigidly linked.

**Battle → BattleParticipant ← User.** Per-player outcome with
`ratingBefore/After` frozen at write time, so historical pages never
re-derive Elo. `unique(battleId, userId)` = one entry per player.

**Battle → Problem (Restrict).** A problem that has been fought over
is load-bearing history; archive it via `visibility`, never delete.

**User → RatingHistory (1:N, Restrict).** Append-only Elo ledger.
`User.rating` is the denormalized current value; this table is the
proof. Restrict because an audit trail that can be cascaded away is
not an audit trail.

**Leaderboard → User.** Durable rank snapshots per `(scope, period)`.
Live boards are Redis sorted sets; this table survives Redis loss and
serves "Week 29 results" pages. `(scope, period, rank)` index makes a
paginated board read a pure index scan.

**Achievement ↔ User via UserAchievement (N:M).** Catalog vs unlock.
`unique(userId, achievementId)` = a badge is earned once.

**User ↔ Problem via Bookmark (N:M).** Pure join with composite PK —
no surrogate id because the pair _is_ the identity.

**User ↔ User via FriendRequest.** Directed edge with status; two
named relations (sender/receiver) on the same model. ACCEPTED rows
_are_ the friendship — no second table to drift out of sync.
`(receiverId, status)` index = the "pending requests inbox" query.

**User → Notification / Activity / Analytics / AdminLog.**
Notification is the inbox (`(userId, readAt, createdAt)` covers badge
count + feed in one index). Activity is the append-only event stream
feeding the profile heatmap. Analytics is the nightly per-user-per-day
rollup — `unique(userId, date)` makes the aggregation job an
idempotent upsert. AdminLog is the immutable privileged-action audit
(Restrict on actor: the trail outlives the admin).

## Design decisions worth naming

- **UUID PKs everywhere** — generatable app-side (no sequence
  round-trip), non-enumerable in URLs, and merge-safe if data is ever
  split across shards or services.
- **Soft delete only where history depends on it** (User, Problem,
  Room). Everything else either cascades with its parent or is itself
  disposable. Soft-deleting everything is an anti-pattern that turns
  every query into a `deletedAt IS NULL` bug hunt.
- **Deliberate denormalization, always with a ledger:**
  `User.rating` ↔ RatingHistory; `Problem.solvedCount/submissionCount`
  ↔ Submission aggregates; Leaderboard ↔ recomputable from
  RatingHistory. Fast reads, with a normalized source to rebuild from.
- **Optimistic locking** via `Problem.version` for concurrent admin
  edits (`UPDATE ... WHERE id = ? AND version = ?`).
- **Json columns only for display-shaped data** (`Room.settings`,
  `Notification.data`, `Activity.metadata`) — payloads rendered by
  type, never joined or filtered relationally.

## Index strategy

Every index maps to a named query; nothing speculative (writes pay
for every index, and Submission is write-heavy):

| Index                                                               | Query it serves                                      |
| ------------------------------------------------------------------- | ---------------------------------------------------- |
| `users(rating DESC)`                                                | global ranking scan / percentile                     |
| `submissions(userId, createdAt DESC)`                               | profile submission feed                              |
| `submissions(userId, problemId, status)`                            | "has user solved X" (solved filter)                  |
| `submissions(problemId, status)`                                    | acceptance-rate stats                                |
| `submissions(status, createdAt)`                                    | judge crash recovery (re-queue stuck PENDING/QUEUED) |
| `leaderboards(scope, period, rank)`                                 | paginated board page N                               |
| `notifications(userId, readAt, createdAt DESC)`                     | unread badge + inbox                                 |
| `friend_requests(receiverId, status)`                               | pending-requests inbox                               |
| `problems(visibility, difficulty)` / `(visibility, createdAt DESC)` | library list filters / newest                        |
| `test_cases(problemId, isHidden)`                                   | judge fetch + statement samples                      |
| `activities(action, createdAt)`                                     | platform-wide metrics                                |
| `analytics(date)`                                                   | "platform on day D" dashboards                       |

## Scalability path

1. **Now (single Postgres):** the rollup split (Analytics), Redis-first
   leaderboards, and denormalized counters keep the hot path free of
   aggregation. Connection pooling via PgBouncer in front of Prisma.
2. **Read scaling:** add read replicas; problem library, profiles and
   leaderboard history are replica-safe reads.
3. **Big-table hygiene:** Submission/SubmissionResult/Activity are the
   growth tables — all append-mostly with time-local access, i.e.
   textbook candidates for monthly range partitioning (raw SQL
   migration) and cold-archival to object storage.
4. **Service extraction:** the schema is already seamed for it —
   judge (Submission*, TestCase), realtime (Room*, Battle*), social
   (FriendRequest, Notification) touch disjoint model clusters joined
   only through User ids, so each cluster can move to its own service
   and database with id-reference integrity instead of FKs.

## Future extensibility

- `TestCase.weight` → partial scoring without migration.
- `ProblemTag` explicit join → per-tag relevance/ordering columns.
- `Room.settings` Json → new room types ship without DDL.
- `LeaderboardScope` / `AchievementType` enums → new competition
  seasons and badge families are enum additions (safe, additive).
- Company tags (prompt-5 filters) → a `Company` + `ProblemCompany`
  pair mirroring the Tag pattern — additive migration, no rewrites.
