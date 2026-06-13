# AGENTS.md

## Workspace layout

```
root/
  services/judge-core/   # Rust workspace
    crates/
      shared/            # models, binary protocol, socket helpers
      agent/             # in-container: compiles & sandboxes user code
      manager/           # on-host: HTTP API, containerd, agent pool
  apps/                  # frontend apps
  packages/              # shared frontend packages
```

- **Package manager**: `bun` (not npm). Run `bun install`.
- **Nx**: thin task runner; `nx build judge-core` delegates to `cargo build`.
- All `cargo` commands must run inside `services/judge-core/`.

## Commands

```bash
# Dependencies
bun install

# Rust (from services/judge-core/)
cargo build --release
cargo build --bin manager # Manager should run with root privileges

# Agent container image
fish scripts/build-agent.fish   # docker build → `ctr image import`
```

## Running the manager

**Prerequisite**: containerd daemon running, reachable at `/run/containerd/containerd.sock`, with a `judge-core` namespace. The agent image (`docker.io/library/judge-core:latest`) must already be imported.

```bash
cargo build run --release --bin manager
sudo ./target/release/manager    # → HTTP on 0.0.0.0:8000
```

No automated tests. Verify manually.

## Architecture essentials

### Manager ↔ agent protocol

Unix domain sockets with **length-prefixed postcard** binary framing (`shared/src/protocol.rs`):

- 4-byte LE `u32` length prefix
- Length `0` = heartbeat → agent disconnects
- Length `> 0` = postcard-encoded frame (`VerdictTask` or `VerdictTaskResult`)

### Agent sandboxing

Two layers per test case (`agent/src/limit/`):

| Layer | Mechanism | Effect |
|---|---|---|
| seccomp | `libseccomp` BPF filter | Whitelist ~35 syscalls; fork/clone/socket blocked |
| cgroups v2 | `cgroups-rs` | Memory limit enforced; CPU time tracked (limit checked post-execution) |

### Execution flow

`POST /task` → `pool.submit()` → dispatch to least-loaded agent → agent
compiles (ccache + g++), runs cases in parallel batches of 8, compares output.

## Conventions

- **rustfmt**: `max_width = 160`, Rust edition 2024

## Key files

| Concern | Path |
|---|---|
| HTTP API + JSON schemas | `crates/manager/src/router.rs`, `crates/shared/src/models/mod.rs` |
| Agent pool + dispatch | `crates/manager/src/pool.rs` |
| Container CRUD + OCI spec | `crates/manager/src/provisioner.rs` |
| Auto-scaling | `crates/manager/src/scaler.rs` |
| Binary framing protocol | `crates/shared/src/protocol.rs` |
| C++ compile + execute | `crates/agent/src/verdict/cpp.rs` |
| seccomp whitelist | `crates/agent/src/limit/seccomp.rs` |
| cgroups v2 management | `crates/agent/src/limit/cgroup.rs` |
| Agent Dockerfile | `crates/agent/Dockerfile` |
