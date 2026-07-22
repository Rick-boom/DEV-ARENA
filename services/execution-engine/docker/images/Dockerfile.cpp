# C++ sandbox image. Minimal Debian slim + g++ only. No shells beyond
# what the compiler needs, no package manager cache. The container is
# always run with --network none, --read-only, and a non-root user by
# the sandbox runner; this image just provides the toolchain.
FROM debian:12-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends g++ \
  && rm -rf /var/lib/apt/lists/*

# nobody user already exists in debian; ensure a writable-free workdir.
WORKDIR /sandbox
USER 65534:65534
CMD ["true"]
