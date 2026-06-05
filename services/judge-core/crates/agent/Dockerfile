# Prepare 
FROM rust:1.96-alpine AS chef
WORKDIR /build
RUN cargo install cargo-chef

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
RUN apk add --no-cache \
    musl-dev \
    libseccomp-dev \
    libseccomp-static \
    linux-headers

COPY --from=planner /build/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json --bin agent

COPY . .
RUN cargo build --release --bin agent

# Runtime
FROM alpine:3.23.4

# `g++` installed
RUN apk add --no-cache libseccomp g++ && \
    rm -rf /var/cache/apk/*

RUN addgroup -g 1000 -S judge && \
    adduser -u 1000 -S judge -G judge && \
    mkdir -p /work /run/judge-core/agents && \
    chown -R judge:judge /work /run/judge-core

COPY --from=builder /build/target/release/agent /usr/local/bin/agent

USER judge

ENTRYPOINT ["/usr/local/bin/agent"]
