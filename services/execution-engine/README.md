# @devarena/execution-engine

Production-grade remote code execution for DevArena. Untrusted source
runs inside single-use, network-isolated, resource-capped Docker
containers, dispatched over a BullMQ work queue.

## Two processes

| Process  | Entry              | Role                                             |
| -------- | ------------------ | ------------------------------------------------ |
| **API**  | `dist/server.js`   | `POST /execute` → enqueue → await verdict. Stateless; scale freely. |
| **Worker** | `dist/index.js`  | Pull jobs → run Docker sandbox → return verdict. Scale for throughput. |

The API needs Redis. The **worker** additionally needs the host Docker
socket mounted (`/var/run/docker.sock`) so it can launch sandboxes.

## Run locally

```bash
pnpm --filter @devarena/execution-engine build:images   # build the 4 sandbox images
pnpm --filter @devarena/execution-engine dev:worker      # terminal 1
pnpm --filter @devarena/execution-engine dev:api         # terminal 2
curl -sX POST localhost:5001/execute -H 'content-type: application/json' \
  -d '{"language":"python","code":"print(sum(map(int,input().split())))","input":"2 7"}'
```

Swagger UI: `http://localhost:5001/docs`.

## Security model

Every execution gets a brand-new container that is **created**
locked-down and **destroyed** immediately after:

- `--network none` — no network access.
- read-only root fs; source bind-mounted read-only; the only writable
  path is an in-memory, `noexec` tmpfs that dies with the container.
- CPU quota, memory cap (swap disabled → overuse is an OOM kill),
  PID limit (fork-bomb containment), open-file + file-size ulimits.
- runs as `nobody`, all Linux capabilities dropped, `no-new-privileges`.
- a wall-clock watchdog force-kills infinite loops; a cron cleanup
  script reaps any orphan if the worker is hard-killed mid-run.

## Verdicts

`ACCEPTED`, `COMPILATION_ERROR`, `RUNTIME_ERROR`, `TIME_LIMIT_EXCEEDED`,
`MEMORY_LIMIT_EXCEEDED`, `OUTPUT_LIMIT_EXCEEDED`, `INTERNAL_ERROR`.

## Scaling to 100k+/day

Throughput is `worker_count × WORKER_CONCURRENCY`. Add worker
containers to scale horizontally; the API stays stateless behind a load
balancer. Admission control sheds load with `QUEUE_FULL` (503) before
Redis is exhausted; exhausted-retry jobs land in the Dead Letter Queue.
