#!/usr/bin/env bash
# Safety-net reaper. The sandbox removes every container in a finally
# block, but if the worker process is SIGKILLed mid-run an orphan could
# survive. Run this on a cron (e.g. every 5 min) as defense in depth:
# it force-removes any leftover exec containers and prunes their temp
# working directories.
set -euo pipefail

# Containers created from our sandbox images.
ORPHANS="$(docker ps -aq --filter 'ancestor=devarena/exec-cpp:latest' \
                          --filter 'ancestor=devarena/exec-java:latest' \
                          --filter 'ancestor=devarena/exec-python:latest' \
                          --filter 'ancestor=devarena/exec-node:latest' 2>/dev/null || true)"
if [ -n "$ORPHANS" ]; then
  echo "Removing orphaned exec containers…"
  echo "$ORPHANS" | xargs -r docker rm -f
fi

# Temp workspaces older than 1 hour (mkdtemp prefix devarena-exec-).
find "${TMPDIR:-/tmp}" -maxdepth 1 -type d -name 'devarena-exec-*' -mmin +60 -exec rm -rf {} + 2>/dev/null || true
echo "Cleanup complete."
