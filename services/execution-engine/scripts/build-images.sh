#!/usr/bin/env bash
# Builds all four sandbox images the runner references. Run once before
# starting the worker (and in CI image-bake steps). Tags match
# LANGUAGE_PROFILES in src/constants/languages.ts.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "Building DevArena sandbox images…"
docker build -f docker/images/Dockerfile.cpp    -t devarena/exec-cpp:latest    docker/images
docker build -f docker/images/Dockerfile.java   -t devarena/exec-java:latest   docker/images
docker build -f docker/images/Dockerfile.python -t devarena/exec-python:latest docker/images
docker build -f docker/images/Dockerfile.node   -t devarena/exec-node:latest   docker/images
echo "Done. Images:"
docker images | grep 'devarena/exec-'
