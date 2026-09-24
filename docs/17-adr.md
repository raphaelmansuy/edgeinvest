# 17 · Architecture decision records (Developer lens)

> Format: context → decision → alternatives rejected → consequences → first principle served. Status values: **Accepted**, **Superseded by ADR-n**.
> A change that weakens any FP needs a new ADR ([00 §6](00-why-first-principles.md#6-how-to-use-this-document-when-in-doubt)).

---

## 1. WHY

Each decision below closes a door on purpose. Writing down the rejected alternatives stops the same debate from restarting in every PR,
and shows a new contributor which constraint a "simpler" idea would break.

```
 FP truths (00) ──► quality attributes (07 §2) ──► ADRs (this page) ──► code structure (07 §5) ──► tests (14)
```

## 2. Index

| ADR | Decision | Status | Serves |
|-----|----------|--------|--------|
| ADR-001 | Bun 1.4 runtime + Hono 4.13 for the API | Accepted | FP-10, simplicity |
| ADR-002 | Vite SPA with TanStack Router, not TanStack Start or Next.js | Accepted | simplicity, FP-5 |
| ADR-003 | PostgreSQL 18 is the only datastore (data, queue, vectors) | Accepted | FP-10 |
| ADR-004 | SQL first with `Bun.sql`; no ORM | Accepted | FP-10, DB constraints |
| ADR-005 | No broker integration and no submit path | Accepted | FP-5 |
| ADR-006 | Ollama runs natively on the host; the LLM is advisory only | Accepted | FP-11 |
| ADR-007 | Deterministic rule registry in a pure domain package | Accepted | FP-1…4, FP-11 |
| ADR-008 | Money as scaled integers, `NUMERIC` in DB, strings on the wire | Accepted | FP-1 |
| ADR-009 | TypeScript 7.0.2 with a 6.0.3 fallback | Accepted | build speed |
| ADR-010 | Server sessions + Postgres RLS, not JWT | Accepted | FP-10, security |
| ADR-011 | MC and crash inline in a Bun Worker; backtest on the PG queue | Accepted | latency |
| ADR-012 | Biome 2.5 for lint and format | Accepted | DRY tooling |
| ADR-013 | Hash-chained append-only audit inside Postgres | Accepted | FP-10 |
| ADR-014 | Paper lab is domain-only (never writes real wheel rows) | Accepted | FP-9 |
| ADR-015 | Versioned explicit disclosure acknowledgements | Accepted | FP-6, compliance |

---

## 3. Records

### ADR-001 Bun runtime with Hono for the API

- **Context.** The stack is fixed to Bun. The API needs typed routes shared with the web client, Zod validation and SSE.
- **Decision.** Bun 1.4.2 runs the API and worker. Hono 4.13 provides routing, middleware, `streamSSE` and the `hc` RPC client types; `@hono/zod-validator` validates input.
- **Rejected.** Express (untyped, Node-centric), Elysia (smaller ecosystem, Bun-only types), Next.js route handlers (couples API to a React framework).
- **Consequences.** One language end to end; the web package compiles against API types, so contract breaks fail `tsc`.

### ADR-002 Vite SPA with TanStack Router, not TanStack Start or Next.js

- **Context.** A single-user local tool behind a login. No SEO, no public pages beyond sign-in. The official Start docs still describe it as a **Release Candidate** (checked 2026-09-23).
- **Decision.** Vite 8.3 SPA; TanStack Router file routes with `autoCodeSplitting`; TanStack Query for server state; all server logic in the Hono API.
- **Rejected.** TanStack Start (RC; SSR and server functions add a second server surface and a second place where an order endpoint could appear), Next.js (App Router + RSC complexity, Node server, conflicts with the Bun/Hono API), Remix/React Router framework mode (same SSR cost).
- **Consequences.** One server surface to audit for the no-submit guarantee; guards run in `beforeLoad` and are re-checked by the API. Revisit if public pages are needed.

### ADR-003 PostgreSQL 18 is the only datastore

- **Context.** Needs mentioned Redis/BullMQ for jobs. Jobs are few (backtests, embeddings) and must be audited with business data.
- **Decision.** PostgreSQL 18.6 holds data, the job queue (`FOR UPDATE SKIP LOCKED`), vectors (pgvector 0.8.6, HNSW) and full-text search.
- **Rejected.** Redis + BullMQ (second stateful service, no transactional enqueue), a separate vector DB (another backup and RLS story).
- **Consequences.** Transactional enqueue with the memo; one backup; RLS covers everything. Throughput limits are far above a single-user load.

### ADR-004 SQL first with `Bun.sql`; no ORM

- **Context.** Correctness lives in constraints, triggers, RLS, temporal keys and PG18 features (`uuidv7()`, `RETURNING old/new`, virtual columns) that ORMs model poorly.
- **Decision.** Hand-written, forward-only SQL migrations; `Bun.sql` tagged templates (parameterised) in repository adapters; row types checked by Zod at the boundary.
- **Rejected.** Prisma (no RLS session variables per transaction, weak support for the features above), Drizzle (good, but a second schema source to keep in sync).
- **Consequences.** The schema is the single source; repository adapters are thin and tested against real Postgres.

### ADR-005 No broker integration and no submit path

- **Context.** IBKR API terms for third-party draft tooling are an open legal question (OPEN-1). The product's core promise is a human gate.
- **Decision.** No broker port, SDK, credentials or order endpoint. The user copies values into IBKR Mobile and records the fill manually (SCR-103). `/orders/*` returns 501 and is audited.
- **Rejected.** IBKR Client Portal API with "draft only" orders (still a transmit path one bug away), TWS API (same).
- **Consequences.** Manual inputs (SCR-102) need cite-or-refuse rules; broker sync stays P1 and would need a new ADR plus legal sign-off.

### ADR-006 Ollama natively on the host; the LLM is advisory only

- **Context.** Docker on macOS has no Metal GPU access, and `qwen3.5:9b-mlx` is an MLX build for Apple Silicon. Probes showed the model misjudges edge cases ([11 §2](11-agent-llm.md#2-the-one-rule-the-llm-explains-code-decides)).
- **Decision.** Ollama 0.34.2 runs natively; containers reach it at `host.docker.internal:11434`. A Linux GPU profile runs the Ollama container instead. The agent can explain, compute through tools and add critiques; it cannot decide.
- **Rejected.** Ollama in Docker on macOS (CPU only, slow), a hosted LLM API (data leaves the machine; not needed for tutoring), LLM-evaluated rules (measured unreliable).
- **Consequences.** App works fully with the agent off (US-12). Nightly evals record the model digest.

### ADR-007 Deterministic rule registry in a pure domain package

- **Context.** Safety decisions must be identical across UI, API, agent tools and tests.
- **Decision.** `packages/domain` exports the rule registry (`{ id, severity, appliesTo, check }`); the evaluator is closed for modification. DB constraints and triggers repeat the most critical rules as defence in depth.
- **Rejected.** Rules in SQL only (poor error messages, no reuse in the game), rules in the front end (bypassable), rules in the LLM (ADR-006).
- **Consequences.** A drift test compares domain transitions with the DB table (EC-DB-004). The paper lab reuses the same rules.

### ADR-008 Money as scaled integers

- **Context.** Floats break the five-number identity at the cent level.
- **Decision.** Domain uses a branded `Usd4` = safe-integer `number` of 1/10,000 USD (overflow throws `UNSAFE_MONEY`); Postgres `NUMERIC(18,4)`; DTOs carry decimal strings validated by regex.
- **Rejected.** float `number` of dollars (drift), `bigint` (no JSON support, slower, not needed below 9×10¹¹ USD), decimal.js (extra dependency), cents-only integers (rates and premiums need 4 dp).
- **Consequences.** One formatter (`MoneyText`); property tests for round trips (EC-MN-001/002).

### ADR-009 TypeScript 7.0.2 with a 6.0.3 fallback

- **Context.** TypeScript 7.0 (the native compiler, released 2026-07-08; `latest` on npm is 7.0.2) type-checks much faster. Some tools load the TypeScript compiler API in-process and may not support 7.0 yet.
- **Decision.** Use `typescript@7.0.2` for `tsc -b` in CI and editors. Bun and Vite transpile without type-checking, so runtime and bundling do not depend on it. If a tool that needs the in-process compiler API fails in F0-T1, pin `typescript@6.0.3` for that tool only (workspace-level override) and record it here.
- **Rejected.** Staying on 6.x everywhere (slower checks for no benefit), skipping type-checking in CI.
- **Consequences.** F0-T1 includes a compatibility check of every tool in the toolchain.

### ADR-010 Server sessions and Postgres RLS, not JWT

- **Context.** Revocation must be instant ("sign out everywhere"), and authorisation must hold even if a use case forgets a `WHERE user_id`.
- **Decision.** Opaque 32-byte session token in a `__Host-sid` cookie; sha256 stored in `session`. Each transaction sets `app.user_id`; RLS on every user table and `security_invoker` on every view.
- **Rejected.** JWT in localStorage (XSS exposure, no revocation), app-level filtering only (one missed filter leaks data).
- **Consequences.** Verified: user B sees 0 rows of A in tables and views; unset user ⇒ 0 rows.

### ADR-011 MC and crash inline; backtest on the queue

- **Context.** MC of 10k paths runs in 10–25 ms locally; a backtest can take seconds.
- **Decision.** Crash and MC run in a Bun Worker with a 2 s timeout inside the request; backtests are queued jobs polled via `GET /jobs/:id`.
- **Rejected.** Queue everything (worse UX for sub-second work), run everything inline (a long backtest blocks the API).
- **Consequences.** Caps protect the API (EC-SM-003); results are stored immutably by input hash.

### ADR-012 Biome for lint and format

- **Decision.** Biome 2.5 replaces ESLint + Prettier. Custom rules: no `dangerouslySetInnerHTML`, no `Math.random`/`Date.now` in `packages/domain` and `packages/sim`.
- **Rejected.** ESLint + Prettier (two tools, slower, plugin drift).

### ADR-013 Hash-chained append-only audit in Postgres

- **Decision.** `audit_event` with per-user `seq`, `payload_hash = sha256(JCS(payload))` and `prev_hash`; UPDATE/DELETE blocked by trigger and REVOKE; written in the same transaction as the change.
- **Rejected.** External log service (not transactional), a blockchain (no benefit for one user).
- **Consequences.** `GET /audit/verify` recomputes the chain. Tamper-evidence, not tamper-proofing, against the DB owner.

### ADR-014 Paper lab is domain-only

- **Context.** A practice lot in the real wheel tables would consume `lots_max` and pollute the ledger.
- **Decision.** The paper lab replays `packages/domain` over `game_attempt.decisions`. It never writes `wheel_cycle`, `option_leg` or `ledger_entry`.
- **Consequences.** EC-LN-007 is testable by row counts. Paper **account** mode (real IBKR paper) still uses the real tables.

### ADR-015 Versioned explicit disclosure acknowledgements

- **Context.** "Disclosure impressions" in Needs cannot be enforced or tested (G14).
- **Decision.** `disclosure_ack (user, key, copy_version)`; capabilities require the current version; required banners are never dismissible.
- **Consequences.** A copy change forces re-ack; compliance can prove who saw which text.

---

## Cross-references

[07 Architecture](07-architecture.md) · [08 Front end](08-frontend-architecture.md) · [09 Database](09-database.md) · [11 Agent](11-agent-llm.md) · [18 References](18-references.md)
