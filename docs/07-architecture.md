# 07 · Architecture (Full-stack Developer lens)

> Stack: Bun 1.4 · Hono 4.13 · Zod 4.6 · PostgreSQL 18.6 + pgvector 0.8.6 · Vite 8.3 SPA · Docker Compose · Ollama (native on macOS).
> Decisions and rejected alternatives are in [17](17-adr.md). Versions and sources: [18](18-references.md#1-stack-versions-verified-2026-09-23).

---

## 1. WHY (architecture lens)

The system's hardest requirement is **negative**: it must never act on the market (FP-5), and it must stay safe when the LLM is
wrong or absent (FP-11). The second hardest is **proof** (FP-10): every state change has an audit event in the same transaction.
Everything else is ordinary CRUD plus two small numeric engines. So we choose the **smallest architecture that makes those
guarantees structural**: one API process, one worker, one database, no message broker, and domain logic in pure functions.

## 2. Quality attributes (ranked; ties are broken by rank)

| Rank | Attribute | Scenario (testable) | Mechanism |
|------|-----------|---------------------|-----------|
| 1 | Safety | Any request path that could send an order → impossible | §9 layered guarantee |
| 2 | Correctness | Five numbers identical everywhere | One `packages/domain`; property tests |
| 3 | Auditability | Every state change → audit event, same tx, chain verifiable | Unit of work §7.3; DB hash chain |
| 4 | Privacy / isolation | User A never reads B's rows, even with a bug in a query | Postgres RLS, fail-closed |
| 5 | Operability | `docker compose up` → working stack in < 2 min on a Mac | Compose healthchecks, migrate job |
| 6 | Performance | MC 10k × 20 < 250 ms p95 inline | Worker thread; measured 10–25 ms |
| 7 | Evolvability | Add a rule, a tool, a market-data source without editing callers | Registries + ports (OCP/DIP) |

## 3. System context (C4 level 1)

```
                         ┌──────────────────────────────┐
   Raphael (browser) ───►│          EdgeInvest          │───► Ollama (local, native macOS, Metal)
   desktop + phone       │  learn · simulate · decide   │     qwen3.5:9b-mlx · embeddinggemma
                         │  draft coach · journal       │
                         └──────────────┬───────────────┘
                                        │  NO CONNECTION (by design, FP-5)
                                        ▼
                         ┌──────────────────────────────┐
                         │ IBKR Mobile / Client Portal  │◄── Raphael reads quotes and balances,
                         │ (the user submits orders)    │    types them into SCR-102, submits orders
                         └──────────────────────────────┘    himself, and records fills on SCR-103
```

## 4. Containers (C4 level 2) and Compose topology

```
 host (macOS)                                                     ┌─────────────────────────┐
 ┌───────────────────────────────────────────────────────────┐    │ ollama serve (native)   │
 │ docker compose (project: edgeinvest)                      │    │ *:11434 · Metal         │
 │                                                           │    └───────────▲─────────────┘
 │  ┌──────────┐ /api proxy ┌──────────┐    SQL (edge_app)   │                │
 │  │ web      │───────────►│ api      │──────────────┐      │                │
 │  │ Vite dev │            │ Bun+Hono │──────────────┼──────┼── HTTP ────────┤
 │  │ :5173    │            │ :8787    │              │      │ host.docker.internal:11434
 │  └──────────┘            └────┬─────┘              ▼      │                │
 │                               │ inline sims  ┌──────────┐ │                │
 │                               │ (Bun Worker) │ db       │ │                │
 │  ┌──────────┐   SKIP LOCKED   │              │ PG 18.6  │ │                │
 │  │ worker   │─────────────────┼─────────────►│ pgvector │ │                │
 │  │ Bun      │─────────────────┼──────────────┼──────────┼─┼── embeddings ──┘
 │  └──────────┘                 │              └────▲─────┘ │
 │  ┌──────────┐  runs once, then exits               │      │
 │  │ migrate  │──────────────────────────────────────┘      │
 │  └──────────┘  (edge_owner role)                          │
 └───────────────────────────────────────────────────────────┘
 Ports bound to 127.0.0.1 only. Linux + GPU hosts: profile `linux-gpu` adds an `ollama` container.
```

### 4.1 `compose.yaml` (normative)

```yaml
name: edgeinvest

x-bun-app: &bun-app
  build: { context: ., dockerfile: Dockerfile }
  env_file: [.env]
  extra_hosts: ["host.docker.internal:host-gateway"]   # reach native Ollama on macOS/Linux
  restart: unless-stopped
  depends_on:
    db: { condition: service_healthy }
    migrate: { condition: service_completed_successfully }

services:
  db:
    image: pgvector/pgvector:0.8.6-pg18-trixie
    environment:
      POSTGRES_USER: edge_owner
      POSTGRES_PASSWORD: ${POSTGRES_OWNER_PASSWORD:?set in .env}
      POSTGRES_DB: edgeinvest
    volumes:
      - pgdata:/var/lib/postgresql          # PG18 images: PGDATA=/var/lib/postgresql/18/docker
    ports: ["127.0.0.1:5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U edge_owner -d edgeinvest"]
      interval: 5s
      timeout: 3s
      retries: 20

  migrate:
    build: { context: ., dockerfile: Dockerfile, target: migrate }
    env_file: [.env]
    depends_on: { db: { condition: service_healthy } }
    restart: "no"

  api:
    <<: *bun-app
    build: { context: ., dockerfile: Dockerfile, target: api }
    environment:
      DATABASE_URL: postgres://edge_app:${EDGE_APP_PASSWORD:?}@db:5432/edgeinvest
      OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://host.docker.internal:11434}
      AGENT_PROVIDER: ${AGENT_PROVIDER:-ollama}          # 'fake' in e2e
      AGENT_MODEL: ${AGENT_MODEL:-qwen3.5:9b-mlx}
      EMBED_MODEL: ${EMBED_MODEL:-embeddinggemma}
    ports: ["127.0.0.1:8787:8787"]
    healthcheck:
      test: ["CMD", "bun", "-e", "fetch('http://127.0.0.1:8787/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 3s
      retries: 10
    develop:
      watch:
        - { action: sync+restart, path: ./apps/api/src, target: /repo/apps/api/src }
        - { action: sync+restart, path: ./packages, target: /repo/packages }
        - { action: rebuild, path: ./bun.lock }

  worker:
    <<: *bun-app
    build: { context: ., dockerfile: Dockerfile, target: worker }
    environment:
      DATABASE_URL: postgres://edge_app:${EDGE_APP_PASSWORD:?}@db:5432/edgeinvest
      OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://host.docker.internal:11434}
      EMBED_MODEL: ${EMBED_MODEL:-embeddinggemma}

  web:
    build: { context: ., dockerfile: Dockerfile, target: web-dev }
    environment:
      API_PROXY_TARGET: http://api:8787
    ports: ["127.0.0.1:5173:5173"]
    depends_on: { api: { condition: service_healthy } }
    develop:
      watch:
        - { action: sync, path: ./apps/web/src, target: /repo/apps/web/src }
        - { action: sync, path: ./packages, target: /repo/packages }
        - { action: rebuild, path: ./bun.lock }

  ollama:                                  # only for Linux hosts with an NVIDIA GPU
    image: ollama/ollama
    profiles: ["linux-gpu"]
    volumes: [ollama:/root/.ollama]
    deploy:
      resources:
        reservations:
          devices: [{ driver: nvidia, count: all, capabilities: [gpu] }]

volumes:
  pgdata:
  ollama:
```

`compose.test.yaml` (override for e2e): `AGENT_PROVIDER=fake`, the db on `tmpfs: /var/lib/postgresql`, and a `SEED_FIXTURES=1` flag on the migrate step.
Run with `docker compose -f compose.yaml -f compose.test.yaml up -d --wait`.

### 4.2 `Dockerfile` (multi-stage; one image family, many targets)

```dockerfile
FROM oven/bun:1.4.2 AS deps
WORKDIR /repo
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/ packages/
RUN bun install --frozen-lockfile

FROM deps AS src
COPY . .

FROM src AS migrate
USER bun
CMD ["bun", "run", "db:migrate"]

FROM src AS api
USER bun
EXPOSE 8787
CMD ["bun", "run", "--cwd", "apps/api", "start"]

FROM src AS worker
USER bun
CMD ["bun", "run", "--cwd", "apps/worker", "start"]

FROM src AS web-dev
USER bun
EXPOSE 5173
CMD ["bun", "run", "--cwd", "apps/web", "dev", "--host", "0.0.0.0"]
```

## 5. Monorepo and dependency rules

```
edgeinvest/
├─ apps/
│  ├─ web/        Vite 8 + React 19.3 + TanStack Router/Query/Form/Table + Tailwind 4
│  ├─ api/        Bun + Hono: HTTP adapters, use cases, composition root (src/main.ts)
│  └─ worker/     Bun: job runner (backtest, embed) using the same use cases
├─ packages/
│  ├─ domain/     PURE: money, invariants, envelope, rules, wheel, mastery, calendar (no I/O)
│  ├─ sim/        PURE: payoff, crash replay, Monte Carlo, backtest (seeded RNG)
│  ├─ contracts/  Zod schemas: API DTOs, tool schemas, screen registry, error codes
│  ├─ copy/       Versioned user-facing strings + banned-phrase lint rules
│  ├─ content/    Curriculum, quiz item generators, scenarios, remediation cards
│  └─ ui/         React components (tokens from apps/web styles)
├─ db/migrations/ 001_init.sql (= docs/appendix/sql/001_init.sql), 002_…
├─ e2e/           Playwright specs, fixtures, FakeLLM scripts
└─ compose.yaml · compose.test.yaml · Dockerfile · biome.json · tsconfig.base.json
```

```
 Allowed imports (enforced by a dependency-cruiser-style test in CI; arrows point to what you may import)

   apps/web ──► ui ──► contracts ──► domain
      │                    ▲            ▲
      └────────────────────┘            │
   apps/api ──► contracts, domain, sim, copy, content
   apps/worker ──► (apps/api use cases via a package export), sim, domain
   domain ──► (nothing)        sim ──► domain        copy, content ──► contracts
   ✗ domain/sim never import Hono, Bun.sql, fetch, Date.now (Clock port), Math.random (seeded RNG)
```

## 6. API surface

Base path `/api/v1`. JSON only. Money as decimal **strings**. Mutations need `Idempotency-Key` (UUID) and the `X-CSRF` header.
Errors are RFC 9457 `application/problem+json` with a stable `code` (§8.1). Contracts are Zod schemas in `packages/contracts`, and the web client uses Hono `hc` types.

| Method & path | Use case | SCR | Notes |
|---------------|----------|-----|-------|
| `POST /auth/sign-in` · `POST /auth/sign-out` | SignIn / SignOut | 100, 070 | rate-limited; `?all=1` revokes all sessions |
| `GET /me` · `PATCH /me` | Profile | 070, 101 | jurisdiction change resets `onboarded` |
| `GET /me/capabilities` | ComputeCapabilities | all | drives guards ([08 §4](08-frontend-architecture.md#4-guards-capabilities-drive-routes)) |
| `PATCH /me/envelope` · `PATCH /me/mode` | SelectEnvelope / SetMode | 071, 072 | override flag + typed phrase |
| `GET /me/disclosures` · `POST /me/disclosures/:key/ack` | AckDisclosure | 101, 073 | body `copy_version` |
| `GET /curriculum/:slug` | GetContent | 001–005 | content_version in ETag |
| `POST /quiz/:module/attempts` | GradeQuiz | 006 | server grading, seeded items |
| `GET /mastery` | GetMastery | 007 | projection |
| `POST /game/attempts` · `PATCH /game/attempts/:id` | Start/AdvanceGame | 008–012 | decisions appended |
| `POST /calc/invariants` | CalcInvariants | 004, 020 | pure; no DB |
| `POST /sim/payoff` · `POST /sim/crash` · `POST /sim/mc` | RunPayoff / RunCrash / RunMc | 020–022 | inline, caps §12; result stored (dedup) |
| `POST /sim/backtest` → 202 · `GET /jobs/:id` | QueueBacktest | 023 | PG job queue |
| `POST /inputs/account-snapshots` · `…/market-snapshots` · `…/rates` · `GET …/latest` | CaptureInputs | 102, 030 | cite-or-refuse CHECKs |
| `POST /memos` · `GET /memos` · `GET /memos/:id` | CreateMemo / ListMemos | 031–033, 036 | snapshot ids pinned on the memo |
| `POST /memos/:id/candidates:score` | ScoreCandidates | 031, 036 | replaces candidate rows while `building` |
| `PUT /memos/:id/stress/:kind` | AttachStress | 032, 037 | 409 `MEMO_FROZEN` once a draft exists |
| `POST /memos/:id/skip` · `POST /memos/:id/decide` | SkipMemo / DecideMemo | 032, 037 | `sell` needs pre-commitment plan |
| `POST /drafts` · `GET /drafts/:id` | PrepareDraft | 032, 037, 038 | runs rule registry; 201 `open` or `blocked` |
| `POST /drafts/:id/review` | ReviewDraft | 041 | rules (authoritative) + optional agent critique |
| `POST /drafts/:id/steps` | MarkPlaybookStep | 040, 043 | precheck may raise `paper_bar_missing` |
| `POST /drafts/:id/human-gate` · `DELETE /drafts/:id` | ConfirmUserSubmitted / Discard | 042 | status → `submitted_by_user` |
| `POST /drafts/:id/fill` | RecordFill | 103 | opens cycle/leg; ledger; audit |
| `POST /cycles/:id/events` | RecordLifecycleEvent | 103, 034, 044 | `expired · bought_back · rolled · assigned · called_away · shares_sold` |
| `GET /wheel/state` · `POST /wheel/willingness` · `DELETE /wheel/halt` · `POST /wheel/locked-loss-accept` | Wheel ops | 035, 045 | halt clear re-evaluates condition |
| `GET /audit` · `GET /audit/verify` | ListAudit / VerifyChain | 050 | cursor pagination by `seq` |
| `GET /ledger?group=quarter\|hk_yoa` · `PUT /ledger/:entryId/annotation` · `GET /journal/tax/hk.csv` | Ledger / Export | 046, 051 | export audited `hk_export` |
| `GET /lessons` | ListLessons | 052 | projection |
| `POST /agent/chat` (SSE) · `GET /agent/status` | AgentTurn | 060, drawer | tool loop §[11](11-agent-llm.md) |
| `ANY /orders/*` | **SubmitProbe** | – | always 501 `NOT_IMPLEMENTED_SUBMIT` + audit |
| `GET /healthz` · `GET /readyz` | – | – | readyz checks DB; Ollama is reported, not required |

## 7. Backend design (hexagonal, SOLID)

### 7.1 Layers

```
  HTTP adapter (Hono route)          ── parse (Zod) · authN · CSRF · idempotency · map errors → problem+json
          │ command DTO
          ▼
  Use case (application service)     ── orchestrates; owns the transaction via UnitOfWork
          │ calls pure functions            │ calls ports (interfaces)
          ▼                                 ▼
  packages/domain · packages/sim      Ports: Repos · AuditLog · Clock · MarketData · Llm · JobQueue
  (pure, deterministic)                     ▲
                                            │ implemented by
                                     Adapters: Bun.sql repos · OllamaLlm · FakeLlm · ManualMarketData
                                               FixtureMarketData · SystemClock · FixedClock
  Composition root: apps/api/src/main.ts (the ONLY place that knows concrete adapters)
```

| SOLID | How it shows up here | Test that protects it |
|-------|----------------------|-----------------------|
| **S**ingle responsibility | Route = transport; use case = orchestration; domain = rules. A use case file exports one function | Lint: route files may not import `domain` rule internals |
| **O**pen/closed | Rule registry, tool registry, crash scenario registry, market-data adapters: add an entry, don't edit the evaluator | Registry tests iterate entries |
| **L**iskov | Every `MarketDataPort` adapter passes one shared contract suite (Manual, Fixture, future IBKR) | `marketData.contract.test.ts` runs per adapter |
| **I**nterface segregation | Small ports: `Clock.now()`, `AuditLog.append()`, `Llm.chat()` / `Llm.embed()` split | Type-level; no god "Service" |
| **D**ependency inversion | Use cases depend on ports; adapters injected at the root | Domain/sim import rules (§5) |

**DRY hotspots (one implementation each):** invariants, DTE (ET calendar), money parse/format, rule registry, error-code catalogue,
screen registry, copy strings, Zod schemas (→ API validation, `hc` client types, agent tool JSON Schema via `z.toJSONSchema`).

### 7.2 Ports (TypeScript)

```ts
export interface Clock { now(): Date }                                   // FixedClock in tests, SimClock in paper lab
export interface AuditLog {
  append(e: { action: AuditAction; scr?: ScrId; actor: ActorKind; payload: JsonValue }): Promise<void>
}
export interface MarketDataPort {                                        // no order methods, ever (§9)
  latestSnapshot(underlying: 'QQQ'): Promise<MarketSnapshot | null>
  chain(snapshotId: string, filter: ChainFilter): Promise<OptionQuote[]>
}
export interface Llm {
  chat(req: ChatRequest, signal: AbortSignal): AsyncIterable<ChatChunk>
  embed(texts: string[]): Promise<Float32Array[]>
  status(): Promise<{ available: boolean; model: string }>
}
export interface UnitOfWork { run<T>(userId: UserId, fn: (tx: Tx) => Promise<T>): Promise<T> }
```

### 7.3 Unit of work: RLS context and audit in one transaction

```ts
// apps/api/src/adapters/pg/unitOfWork.ts
export const pgUnitOfWork = (sql: Bun.SQL): UnitOfWork => ({
  run: (userId, fn) =>
    sql.begin(async (tx) => {
      await tx`select set_config('app.user_id', ${userId}, true)`;   // transaction-local → RLS
      return fn(makeTx(tx));                                          // repos + audit share tx
    }),
});

// apps/api/src/usecases/recordFill.ts (shape of every mutating use case)
export const recordFill = (d: Deps) => (cmd: RecordFillCmd, actor: Actor) =>
  d.uow.run(actor.userId, async (tx) => {
    const draft = await tx.drafts.getForUpdate(cmd.draftId);          // SELECT … FOR UPDATE
    if (!draft || draft.status !== 'submitted_by_user') throw problem('ILLEGAL_TRANSITION');
    const fill = parseFill(cmd, d.clock.now());                        // domain: tick, time ≤ now
    const cycle = await tx.cycles.openOrContinue(draft, fill);         // DB trigger: lots, halt
    await tx.ledger.append(ledgerForFill(draft, fill, cycle));         // domain builds entries
    await tx.audit.append({ action: 'fill_recorded', scr: 'SCR-103', actor: 'user',
                            payload: { draftId: draft.id, price: fill.price, cycleId: cycle.id } });
    return cycle;
  });
```

The audit adapter computes `payload_hash = sha256(JCS(payload))` (RFC 8785 via `canonicalize`). The DB trigger assigns `seq` and
`chain_hash` under a per-user advisory lock ([09 §7](09-database.md#7-audit-trail-append-only-and-hash-chained)).

## 8. Cross-cutting concerns

### 8.1 Error catalogue (single source: `packages/contracts/errors.ts`)

| HTTP | `code` | Raised by | UI |
|------|--------|-----------|----|
| 400 | `MALFORMED_REQUEST` | JSON/Zod shape | ProblemAlert |
| 401 | `UNAUTHENTICATED` | session missing/expired | redirect sign-in |
| 403 | `CSRF_FAILED` · `CAPABILITY_MISSING` | header/origin check · guard | ProblemAlert / lock state |
| 404 | `NOT_FOUND` · `UNKNOWN_SCENARIO` | also for rows hidden by RLS (no existence leak) · crash id not in `crash-lib-v1` | EmptyState |
| 409 | `ILLEGAL_TRANSITION` · `STALE_WRITE` · `IDEMPOTENCY_MISMATCH` · `IDEMPOTENCY_IN_PROGRESS` · `MEMO_FROZEN` · `CHAIN_STALE` · `HALT_ACTIVE` · `LOTS_EXCEEDED` · `HALT_CONDITION_PERSISTS` · `STRESS_MISMATCH` | use cases / DB triggers mapped by SQLSTATE + message prefix | explain + one action |
| 422 | `VALIDATION_FAILED` · `PHASE_MISMATCH` · `EMPTY_CHAIN` · `NON_STANDARD_DELIVERABLE` · `OFF_TICK` · `RATE_NOT_CITED` | domain validation | field errors |
| 429 | `RATE_LIMITED` | sign-in, agent, sims | retry-after |
| 501 | `NOT_IMPLEMENTED_SUBMIT` | `/orders/*` probe | "This app never sends orders" |
| 503 | `AGENT_UNAVAILABLE` · `SIM_TIMEOUT` | Ollama down/timeout · sim worker > 2 s | offline banner · "Try fewer paths" |
| 500 | `INTERNAL` | unexpected | "Nothing was sent to any broker" + traceId |

Draft rule failures are **not** HTTP errors. `POST /drafts` returns 201 with `status: "blocked"` and `block_reasons` ([02 §8](02-investment-domain.md#8-draft-checklist-rules)).

### 8.2 Idempotency and concurrency

```
 request with Idempotency-Key K
   │
   ├─ INSERT idempotency_key(user, K, sha256(method+path+body)) ON CONFLICT DO NOTHING
   │     inserted? ──► run use case ──► store status+response ──► reply
   │     conflict  ──► same hash & response stored ──► replay stored response (no side effects)
   │                   same hash & response NULL   ──► 409 IDEMPOTENCY_IN_PROGRESS (Retry-After: 1)
   │                   different hash              ──► 409 IDEMPOTENCY_MISMATCH
   └─ rows expire after 24 h (purge job)
```

- Aggregates that change together are serialised with `SELECT … FOR UPDATE` on `wheel_state` (the per-user serialisation point). The DB trigger does the same on cycle insert (verified race test: the second session fails `LOTS_EXCEEDED`).
- Editable resources (memo, draft) carry an ETag derived from `updated_at`; `If-Match` mismatch ⇒ 409 `STALE_WRITE`.

### 8.3 Time

`Clock` port only. Instants are stored as UTC `timestamptz`, displayed in HKT with ET for market times, and DTE is computed on the
`America/New_York` calendar (`packages/domain/calendar.ts`, verified in the spike: EC-TM-001).

### 8.4 Observability

Structured JSON logs (one line per request: `traceId`, route, status, ms, userId hash). PII and prompt bodies are never logged.
`traceId` is returned in problem+json. Ollama latency and token counts are logged per turn. Metrics come from the audit table (see [01 §6](01-product-spec.md#6-success-metrics-and-instrumentation)).

## 9. The no-submit guarantee

```
 Layer                         Guarantee                                            Verified by
 ────────────────────────────  ───────────────────────────────────────────────────  ─────────────────────────────
 1 Types / ports               No port has place/submit/transmit methods;           arch test: AST scan for
                               BrokerPort (P1) is read-only by interface            /submit|place|transmit/i
 2 Secrets                     No broker credentials exist in config or env in MVP  config schema rejects keys
 3 Agent tools                 Closed allowlist; name/description scan for          tool-registry snapshot test
                               submit-like verbs fails the build                    + red-team suite (@llm)
 4 HTTP                        /api/v1/orders/* → 501 NOT_IMPLEMENTED_SUBMIT        e2e probe [EC-SEC-008]
                               and audit live_submit_attempt_blocked
 5 Data model                  draft_status has no 'sent'; only 'submitted_by_user' DDL review + enum test
                               set by the human gate
 6 UI and copy                 No submit/send CTA; «Sell» banned as a CTA verb      copy lint + e2e scan
 7 Network (P1 hosting)        Egress allowlist: Ollama host only                   infra test when hosted
```

Any change that weakens one of these layers needs an ADR and a new test ([00 §6](00-why-first-principles.md#6-how-to-use-this-document-when-in-doubt)).

## 10. Security

| Concern | Decision | EC |
|---------|----------|----|
| Passwords | `Bun.password.hash` argon2id; DB CHECK enforces the `$argon2id$` prefix | EC-SEC-001 |
| Sessions | 32-byte random token in a `__Host-sid` cookie (Secure, HttpOnly, SameSite=Strict, Path=/); DB stores only sha256; 30-day absolute, 7-day idle expiry | EC-SEC-003 |
| CSRF | SameSite=Strict **and** a required `X-CSRF: 1` header on mutations **and** an `Origin` allowlist check | EC-SEC-004 |
| Authorisation | Postgres RLS on every user table (fail-closed when `app.user_id` is unset); `edge_app` is NOSUPERUSER NOBYPASSRLS | EC-SEC-002 |
| Auth bootstrap | Only `auth_lookup` and `session_resolve` are SECURITY DEFINER, with a pinned `search_path` | EC-SEC-006 |
| Headers | CSP `default-src 'self'; connect-src 'self'; frame-ancestors 'none'`; HSTS in hosted mode; `nosniff`; `Referrer-Policy: same-origin` | EC-SEC-005 |
| Rate limits | Sign-in 5 / 15 min per email+IP; agent 20 turns / 5 min; sims 30 / min | EC-SEC-001, EC-AG-009 |
| Prompt injection | Content and tool results are data, never instructions; tools are read-mostly and cannot change status | EC-AG-005 |
| Secrets | `.env` is git-ignored; `edge_app` password rotated by the migrate step from env | EC-OPS-004 |
| Data at rest | Local volume (macOS FileVault). Hosted mode (OPEN-4): encrypted disk + backups | EC-OPS-005 |

STRIDE summary:

| Threat | Example | Mitigation |
|--------|---------|------------|
| Spoofing | Stolen cookie | HttpOnly + SameSite + short idle expiry + "sign out everywhere" |
| Tampering | Edit an audit row | Append-only triggers + REVOKE UPDATE + hash chain verify |
| Repudiation | "I never confirmed that" | Audit event with actor, SCR, payload hash in the same tx |
| Information disclosure | IDOR on `/memos/:id` | RLS ⇒ 404; UUIDv7 ids are not secrets but still not enumerable across users |
| Denial of service | MC with 10⁹ paths | Zod caps (paths ≤ 20,000; quarters ≤ 40) + rate limit + worker-thread timeout |
| Elevation of privilege | LLM told to "submit" | No such capability exists (§9) |

## 11. Worker and job queue

```sql
-- claim one job (worker loop, every 1 s or on LISTEN/NOTIFY wake-up)
UPDATE app.job SET status = 'running', locked_by = $1, locked_at = now(), attempts = attempts + 1
 WHERE job_id = (SELECT job_id FROM app.job
                  WHERE status = 'queued' AND run_after <= now()
                  ORDER BY run_after FOR UPDATE SKIP LOCKED LIMIT 1)
RETURNING *;
```

- Retries with exponential back-off (`run_after = now() + 2^attempts s`), up to `max_attempts = 3`, then `failed` with `error` JSON.
- A reaper resets `running` jobs whose `locked_at` is older than 10 min (crashed worker, EC-OPS-002).
- Job kinds: `backtest` and `embed`. Monte Carlo and crash run **inline** in a Bun Worker thread (measured 10k×20 in 10–25 ms), with a 2 s hard timeout.
- The worker sets `app.user_id` from `job.user_id` inside its own unit of work. RLS applies to the worker too.

## 12. Performance budgets

| Operation | Budget (p95, local Mac) | Basis |
|-----------|-------------------------|-------|
| API read (list/detail) | < 50 ms | Indexed by `user_id` |
| `POST /sim/mc` 10k × 20 | < 250 ms | Spike measured 10–25 ms + overhead |
| `POST /drafts` (rule registry) | < 30 ms | Pure functions |
| Agent first token | < 3 s (informational) | Local 9B model; not an SLA |
| Web initial load (dev) | < 2 s | Auto code splitting per route |

## 13. Local development

```
 cp .env.example .env                           # set POSTGRES_OWNER_PASSWORD, EDGE_APP_PASSWORD
 ollama pull qwen3.5:9b-mlx && ollama pull embeddinggemma   # native, once
 docker compose up --watch                      # db → migrate → api/worker → web
 open http://localhost:5173
 bun test                                       # unit + property (packages/*)
 bun run test:int                               # integration vs real PG (template DB per file)
 docker compose -f compose.yaml -f compose.test.yaml up -d --wait && bunx playwright test
```

---

## Cross-references

[02 Domain](02-investment-domain.md) · [08 Front-end](08-frontend-architecture.md) · [09 Database](09-database.md) · [10 Simulation](10-simulation-engines.md) ·
[11 Agent](11-agent-llm.md) · [13 EC-SEC / EC-OPS](13-edge-cases.md#ec-sec-security) · [14 Tests](14-test-strategy.md) · [17 ADRs](17-adr.md)
