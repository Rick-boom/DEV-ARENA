# Java sandbox image. Eclipse Temurin JDK 21 (headless). The runner
# caps the JVM heap (-XX:+UseSerialGC) so memory overuse surfaces as an
# OOM kill inside our cgroup limit rather than swapping the host.
FROM eclipse-temurin:21-jdk-jammy

WORKDIR /sandbox
USER 65534:65534
CMD ["true"]
