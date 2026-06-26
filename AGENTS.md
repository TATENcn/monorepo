# AGENTS.md

## Workspace layout

```
onlinejudge/
├── packages/
│   ├── algorithm/             # Rating & ranking algorithms
│   └── utils/
├── services/crates/
│   ├── api_server/            # HTTP API (port 3080) — Axum, SeaORM
│   ├── auth/                  # OAuth2 token server — Axum, SeaORM
│   ├── judge_core_shared/     # Shared models, HTTP types, wire protocol, error codes
│   ├── judge_core_sdk/        # Rust HTTP client for judge_core_manager
│   ├── judge_core_manager/    # Agent pool + autoscaler + HTTP router (port 8000)
│   ├── judge_core_agent/      # Sandboxed compile/run, Unix socket server
│   ├── judge_core_agent_standalone/  # Single-binary agent, HTTP /task endpoint
│   └── submission_processor/  # RabbitMQ consumer → judge_core bridge
├── scripts/build-agent.fish   # Build & load agent image into containerd
├── nx.json                    # Task orchestration, caching
├── biome.json                 # Formatter/linter
├── package.json               # Bun workspace root
└── tsconfig.json
```

Bun workspaces (TS packages) + Cargo workspace (Rust services). Nx for task orchestration.

## Commands

| Command | Description |
|---|---|
| `bun install` | Install TS dependencies |
| `bunx nx <target> <project>` | Build/lint/typecheck with Nx caching |
| `cd services && cargo run -p <crate>` | Run a Rust crate |

## Running services

**Judge core — manager + agent (production, requires root):**
```fish
fish scripts/build-agent.fish
cd services && sudo cargo run -p judge_core_manager
```

**Judge core — standalone (single binary, no containerd):**
```fish
cd services && cargo run -p judge_core_agent_standalone
```

**Submission processor:**
```fish
cd services && RABBIT_MQ_URL=amqp://... JUDGE_CORE_URL=http://localhost:8000 cargo run -p submission_processor
```

## Architecture

### Submission pipeline

```
API (POST /submissions) → RabbitMQ (submit.queue)
  → submission_processor → POST /task to manager (port 8000)
  → manager dispatches to agent via Unix socket
  → agent sandbox-compiles and runs
  → result flows back through RabbitMQ (result.queue)
  → API consumer updates DB
```

### Manager ↔ Agent wire protocol

Binary postcard frames over Unix stream. Data frame: 4-byte LE length prefix → `Frame<T> { id: u64, inner: T }`. Heartbeat: `u32::LE(0)` echoed back.

### Agent sandboxing

containerd containers with user/PID/mount/network/cgroup namespaces, cgroup v2 limits, seccomp filtering, `/work` tmpfs. Requires root (containerd socket at `/run/containerd/containerd.sock`).

## Key files

| File | Role |
|---|---|
| `services/crates/api_server/src/main.rs` | API entry point |
| `services/crates/auth/src/router.rs` | Token, revoke, introspect, JWKS endpoints |
| `services/crates/auth/src/token.rs` | Ed25519 JWT generation/verification |
| `services/crates/judge_core_shared/src/models/mod.rs` | `VerdictTask`, `VerdictTaskResult`, `Language`, verdict types |
| `services/crates/judge_core_shared/src/models/http.rs` | `VerdictResponse`, error codes (`ERR_*`), `PoolMetrics` |
| `services/crates/judge_core_shared/src/protocol.rs` | Wire protocol + heartbeat |
| `services/crates/judge_core_sdk/src/lib.rs` | Rust HTTP client for manager |
| `services/crates/judge_core_manager/src/main.rs` | Manager entry — containerd, pool, autoscaler, Axum |
| `services/crates/judge_core_manager/src/pool.rs` | Agent pool: dispatch, health checks, retries, drain |
| `services/crates/judge_core_manager/src/provisioner.rs` | Containerd OCI container lifecycle |
| `services/crates/judge_core_manager/src/router.rs` | Axum routes + `PoolError` → HTTP |
| `services/crates/judge_core_manager/src/scaler.rs` | Autoscaler with EMA utilization tracking |
| `services/crates/judge_core_agent/src/main.rs` | Agent entry — Unix listener |
| `services/crates/judge_core_agent/src/verdict/cpp.rs` | C++ compile + run with resource limits |
| `services/crates/judge_core_agent/src/limit/cgroup.rs` | cgroup v2 enforcement |
| `services/crates/judge_core_agent/src/limit/seccomp.rs` | Seccomp syscall filter |
| `services/crates/judge_core_agent_standalone/src/main.rs` | Standalone — HTTP /task endpoint |
| `services/crates/submission_processor/src/main.rs` | RabbitMQ consumer entry |
| `services/crates/submission_processor/src/rabbitmq.rs` | RabbitMQ connection + topology |
| `services/crates/submission_processor/src/message.rs` | `SubmitMessage` / `ResultMessage` types |

## Conventions

- **Error codes**: `judge_core_shared::models::http` (`ERR_QUEUE_FULL`, `ERR_TASK_TIMEOUT`, etc.)
- **Serialization**: serde internally-tagged enums (`tag = "status"`, `tag = "case_status"`)
- **Formatting**: Biome (TS), rustfmt (Rust)
