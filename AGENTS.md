# AGENTS.md

## Workspace layout

```
onlinejudge/
├── apps/api/                  # Elysia HTTP API (port 3080) — Better Auth, Drizzle/Postgres
├── packages/
│   ├── judge-core-sdk/        # TS HTTP client for judge_core_manager
│   ├── models/                # Shared TS types (submit/result messages, verdict types)
│   ├── algorithm/             # Rating algorithms
│   └── utils/
├── services/crates/
│   ├── judge_core_shared/     # Rust models, HTTP types, wire protocol, error codes
│   ├── judge_core_sdk/        # Rust HTTP client for judge_core_manager
│   ├── judge_core_manager/    # Agent pool + autoscaler + HTTP router (port 8000)
│   ├── judge_core_agent/      # Sandboxed compile/run, Unix socket server
│   ├── judge_core_agent_standalone/  # Single-node agent with HTTP interface
│   └── submission_processor/  # RabbitMQ consumer → judge_core bridge
├── scripts/build-agent.fish   # Build & load agent image into containerd
├── nx.json                    # Task orchestration, caching
├── biome.json                 # Formatter/linter
├── package.json               # Bun workspace root
└── tsconfig.json
```

Monorepo: Bun workspaces (TS) + Cargo workspace (Rust). Nx handles task dependencies and caching.

## Commands

| Command | Description |
|---|---|
| `bun install` | Install TS dependencies |
| `bunx nx <target> <project>` | Run build/lint/typecheck with Nx caching |
| `bunx nx run-many -t build` | Build all TS projects in dependency order |

Nx infers TypeScript tasks automatically via its plugin. No `project.json` targets needed for build/lint/typecheck.

## Running `judge_core`

Two modes:

**Manager + Agent** (production, containerd-based pool):
```fish
fish scripts/build-agent.fish
cd services && cargo run -p judge_core_manager
# Manager autoscales 2–5 agents. Each agent listens on /run/judge-core/agents/<id>/agent.sock
```

**Standalone** (single binary, no containerd):
```fish
cd services && cargo run -p judge_core_agent_standalone
# Listens on 0.0.0.0:8000, single /task endpoint
```

## Running `submission_processor`

```fish
RABBIT_MQ_URL=amqp://... JUDGE_CORE_URL=http://localhost:8000 \
  cargo run -p submission_processor
# Set JUDGE_CORE_STANDALONE=true for standalone mode
```

## Architecture

**Submission pipeline:** API (`POST /submissions`) → RabbitMQ publish → `submission_processor` consumes → `POST /task` to manager → manager dispatches to agent via Unix socket → agent sandbox-compiles and runs → result flows back through RabbitMQ → API consumer updates DB.

**Communication:** AMQP (API ↔ processor, JSON), HTTP REST (processor ↔ manager, JSON), Unix stream (manager ↔ agent, postcard binary frames with heartbeat).

**Manager HTTP API:**

| Method | Path | Description |
|---|---|---|
| GET | `/metricsz` | Pool metrics (queue size, agent counts, active tasks) |
| GET | `/acceptablez` | Whether the pool can accept work (`acceptable: bool` + metrics) |
| POST | `/task` | Submit a `VerdictTask`, returns `VerdictResponse` |

**Agent sandboxing:** containerd containers with user/PID/mount/network/cgroup namespaces, cgroup v2 limits, seccomp filtering, `/work` tmpfs for compilation.

## Key files

| File | Role |
|---|---|
| `apps/api/src/main.ts` | API entry point |
| `apps/api/src/modules/db/schema.ts` | Drizzle schema — problems, test cases, submissions |
| `apps/api/src/modules/submission/index.ts` | Submit endpoint + RabbitMQ result consumer |
| `packages/models/src/judge-core.ts` | TS types for verdict tasks/results |
| `packages/judge-core-sdk/src/client.ts` | TS HTTP client for manager |
| `services/crates/judge_core_shared/src/models/mod.rs` | Core Rust types: `VerdictTask`, `VerdictTaskResult`, `Language` |
| `services/crates/judge_core_shared/src/models/http.rs` | HTTP types, error codes, `VerdictResponse` |
| `services/crates/judge_core_shared/src/protocol.rs` | Manager↔Agent wire protocol |
| `services/crates/judge_core_sdk/src/lib.rs` | Rust HTTP client for manager (used by submission_processor) |
| `services/crates/judge_core_manager/src/main.rs` | Manager entry point |
| `services/crates/judge_core_manager/src/pool.rs` | Agent pool: dispatch, health checks, retries |
| `services/crates/judge_core_manager/src/provisioner.rs` | Containerd OCI container lifecycle |
| `services/crates/judge_core_manager/src/router.rs` | Axum routes + PoolError → HTTP mapping |
| `services/crates/judge_core_manager/src/scaler.rs` | Autoscaler with EMA utilization tracking |
| `services/crates/judge_core_agent/src/main.rs` | Agent entry point (Unix socket server) |
| `services/crates/judge_core_agent/src/verdict/cpp.rs` | C++ compile + run with resource limits |
| `services/crates/judge_core_agent/src/limit/cgroup.rs` | cgroup v2 enforcement |
| `services/crates/judge_core_agent/src/limit/seccomp.rs` | Seccomp syscall filter |
| `services/crates/judge_core_agent_standalone/src/main.rs` | Standalone entry point |
| `services/crates/submission_processor/src/main.rs` | RabbitMQ consumer entry point |
| `services/Cargo.toml` | Rust workspace root, shared deps |

## Conventions

- **Error codes** are centralized in `judge_core_shared::models::http` (`ERR_*` constants). The manager router and TS SDK both reference these.
- **Formatting:** Biome for TS, rustfmt for Rust.
- **Nx `build`** depends on `^build` — builds dependencies first. No explicit project config needed for standard TS tasks.
