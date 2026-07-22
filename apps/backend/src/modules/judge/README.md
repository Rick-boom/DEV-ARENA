# DevArena Online Judge Service

Consumes execution results, runs public + hidden test cases, produces verdicts,
scores submissions, persists results, and publishes battle events. Built to
absorb 500k submissions/day.

## Zero schema changes

The existing schema already had everything:

- `SubmissionStatus` enum contains **all 13 verdicts** the spec lists (including
  `PRESENTATION_ERROR`, `OUTPUT_LIMIT_EXCEEDED`, `SKIPPED`, `INTERNAL_ERROR`).
- `SubmissionResult` stores the per-test-case verdict + runtime + memory + stderr,
  with `@@unique([submissionId, testCaseId])` making retried judging idempotent.
- `TestCase` has `isHidden`, `weight`, `order` — enough for public/hidden ordering
  and weighted partial scoring.
- `Problem` has `timeLimitMs` / `memoryLimitMb`.
- `Submission` has the `[status, createdAt]` index for queue recovery.

The one thing absent is a `comparator` column, so the judge **derives** it per
problem (float tolerance when expected outputs contain decimals, otherwise
whitespace-normalized token compare). Adding a column later changes exactly one
method: `PrismaProblemRepository.deriveComparator`.

## Submission → verdict (happy path)

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Submission API
    participant R as Redis
    participant DB as Postgres
    participant Q as BullMQ Queue
    participant W as Judge Worker
    participant E as Execution Engine
    participant B as Battle Engine

    C->>API: POST /submission {problemId, language, code}
    API->>R: rate-limit + duplicate guard
    API->>DB: resolve problem (limits + test cases)
    API->>DB: INSERT submission (PENDING)
    API->>DB: status = QUEUED
    API->>Q: enqueue(job, priority)
    API-->>C: 202 { submissionId }
    API-->>B: publish submission.created

    Q->>W: dequeue job
    W->>DB: status = RUNNING
    W-->>B: publish submission.started

    loop batches of TESTCASE_CONCURRENCY (public first, then hidden)
        W->>E: run(code, stdin, limits)
        E-->>W: {stdout, stderr, exitCode, durationMs, memoryUsedMb, oomKilled, timedOut, truncated}
        W->>W: VerdictMapper.map(outcome, expected, comparator)
        W->>DB: upsert SubmissionResult
        W-->>B: publish submission.running {completed, total}
    end

    W->>W: ScoringEngine.aggregate(results)
    W->>DB: finalize (verdict, runtimeMs, peakMemoryKb)
    W-->>B: publish submission.completed
    W-->>B: publish submission.verdict {verdict, passed, total, score}
    B->>B: update battle scoreboard
```

## Verdict precedence (the critical ordering)

```mermaid
flowchart TD
    A[Execution outcome] --> B{compileError?}
    B -->|yes| CE[COMPILATION_ERROR]
    B -->|no| C{timedOut?}
    C -->|yes| TLE[TIME_LIMIT_EXCEEDED]
    C -->|no| D{oomKilled?}
    D -->|yes| MLE[MEMORY_LIMIT_EXCEEDED]
    D -->|no| E{truncated?}
    E -->|yes| OLE[OUTPUT_LIMIT_EXCEEDED]
    E -->|no| F{exitCode != 0?}
    F -->|yes| RE[RUNTIME_ERROR]
    F -->|no| G[Compare output]
    G --> H{tokens match?}
    H -->|no| WA[WRONG_ANSWER]
    H -->|yes| I{layout identical?}
    I -->|yes| AC[ACCEPTED]
    I -->|no| PE[PRESENTATION_ERROR]
```

Resource limits are decided **before** output comparison: a program that timed
out or crashed has no meaningful stdout, so reporting it as `WRONG_ANSWER` would
be a lie. This precedence is the judge's contract with users.

## Failure path (retry → DLQ)

```mermaid
sequenceDiagram
    participant Q as BullMQ
    participant W as Judge Worker
    participant E as Execution Engine
    participant DLQ as Dead Letter Queue
    participant DB as Postgres

    Q->>W: job (attempt 1)
    W->>E: run test case
    E--xW: ECONNREFUSED
    W->>DB: status = INTERNAL_ERROR
    W-->>Q: throw ExecutionUnavailable
    Q->>Q: exponential backoff
    Q->>W: job (attempt 2, 3)
    W--xQ: still failing
    Q->>DLQ: park job for inspection
    Q->>DB: status = INTERNAL_ERROR (never blamed on user)
```

## Scaling to 500k/day

- **Async API** — `POST /submission` returns 202 after a durable insert + enqueue;
  no web request ever waits on a sandbox.
- **Horizontal workers** — throughput scales linearly with workers × concurrency
  since all coordination lives in Redis/BullMQ.
- **Bounded per-submission parallelism** — one 100-test-case submission can't
  monopolise the engine (`TESTCASE_CONCURRENCY`).
- **Stop-on-first-fail** — contest/battle submissions skip remaining cases after
  the first failure, cutting engine work dramatically on wrong submissions.
- **Priority queue** — battle submissions judged ahead of practice.
- **Idempotency** — `jobId = submissionId` means a submission is never
  double-queued; result upserts make retries safe.

## Files

- `comparators/output-comparator.ts` — token / exact / float compare + presentation detection.
- `verdict/verdict-mapper.ts` — execution outcome → verdict, with the precedence above.
- `scoring/scoring-engine.ts` — all-or-nothing and weighted-partial aggregation.
- `services/judge.service.ts` — the worker-side judging pipeline.
- `services/submission.service.ts` — API-side admission (rate limit, dedupe, enqueue).
- `queue/judge.queue.ts`, `queue/judge.worker.ts` — BullMQ queue + worker with DLQ.
- `repositories/` — Prisma submission/problem repos, HTTP execution adapter, Redis support.
- `events/redis-event-publisher.adapter.ts` — pub/sub + in-process battle bridge.
- `controllers/`, `routes/`, `validators/`, `docs/` — the REST surface.
