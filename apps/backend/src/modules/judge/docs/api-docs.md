# DevArena Judge Service — API Documentation

All endpoints require a Bearer JWT (auth is handled by the assumed Auth
Service). Base path: `/api/v1`. Responses use the envelope
`{ "success": boolean, "data"?: ..., "error"?: { code, message } }`.

## POST /submission

Create and queue a submission. Returns immediately (202) — judging is
asynchronous; poll `GET /submission/:id/result` or listen for the
`submission.*` socket events.

Request body:

| field | type | required | notes |
|---|---|---|---|
| `problemId` | uuid | yes | |
| `battleId` | uuid | no | raises queue priority when present |
| `language` | enum | yes | JAVASCRIPT, TYPESCRIPT, PYTHON, CPP, JAVA |
| `code` | string | yes | ≤ 100 KB |
| `comparisonMode` | enum | no | EXACT, WHITESPACE (default), FLOAT, CUSTOM |
| `stopOnFirstFailure` | bool | no | default true (ICPC-style); false = full partial scoring |

Responses: `202` queued · `409` DUPLICATE_SUBMISSION · `422` INVALID_LANGUAGE ·
`429` SUBMISSION_RATE_LIMITED · `503` QUEUE_UNAVAILABLE.

## GET /submission/:id

Submission status (owner only). `403` if not the owner, `404` if unknown.

## GET /submission/:id/result

Full verdict with per-test-case results and score. Hidden test cases are
reported as pass/verdict only — their input/expected/stderr are never
disclosed. Fields: `verdict`, `score`, `maxScore`, `percentage`,
`results[]` (each: `testCaseId`, `verdict`, `passed`, `runtimeMs`,
`memoryKb`, `score`, `maxScore`, `isHidden`).

## GET /submission/history?page&pageSize

The authenticated user's submissions, newest first (paginated).

## Verdicts

`ACCEPTED`, `WRONG_ANSWER`, `COMPILATION_ERROR`, `RUNTIME_ERROR`,
`TIME_LIMIT_EXCEEDED`, `MEMORY_LIMIT_EXCEEDED`, `OUTPUT_LIMIT_EXCEEDED`,
`PRESENTATION_ERROR`, `INTERNAL_ERROR`, `SKIPPED`.

## Events (Redis Pub/Sub → Socket layer)

`submission.created`, `submission.started`, `submission.running`
(per-test-case, enables streaming progress), `submission.completed`,
`submission.failed`, `submission.verdict`.

## Schema note

The only schema change this service required was adding three durable
verdicts to the `SubmissionStatus` enum — `OUTPUT_LIMIT_EXCEEDED`,
`PRESENTATION_ERROR`, `SKIPPED` — since these are real, permanent
outcomes the judge produces. Enum additions are backward-compatible
(existing rows/queries are unaffected). Everything else reuses the
existing `Submission`, `SubmissionResult`, `TestCase`, and `Problem`
models.
