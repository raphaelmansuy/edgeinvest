# 18 · References and verification log (everyone)

> Every version below was read from the registry or the running binary on **2026-09-23**. Every URL below returned HTTP 200 on that date
> (except where noted). The verification log lists what was **executed**, not just written.

---

## 1. Stack versions (verified 2026-09-23)

| Layer | Package / tool | Version | How verified |
|-------|----------------|---------|--------------|
| Runtime | Bun | 1.4.2 | `bun --version`; image `oven/bun:1.4.2` |
| Build | vite | 8.3.0 | `npm view` |
| Build | @vitejs/plugin-react | 6.1.1 | `npm view` |
| UI | react, react-dom | 19.3.0 | `npm view` |
| CSS | tailwindcss, @tailwindcss/vite | 4.3.3 | `npm view` |
| Routing | @tanstack/react-router | 1.170.39 | `npm view` |
| Routing | @tanstack/router-plugin | 1.168.40 | `npm view` |
| Server state | @tanstack/react-query | 5.103.2 | `npm view` |
| Forms | @tanstack/react-form | 1.33.5 | `npm view` |
| Tables | @tanstack/react-table | 9.2.4 | `npm view` |
| Virtualisation | @tanstack/react-virtual | 3.14.13 | `npm view` |
| API | hono | 4.13.8 | `npm view` |
| API | @hono/zod-validator | 0.9.1 | `npm view` |
| Validation | zod | 4.6.5 | `npm view`; used by the domain spike |
| Tests | @playwright/test | 1.63.0 | `npm view` |
| Tests | @axe-core/playwright | 4.13.0 | `npm view` |
| Tests | fast-check | 4.10.2 | `npm view`; used by the domain spike |
| Tests | msw | 2.15.0 | `npm view` |
| Language | typescript | 7.0.2 (`latest`); 6.0.3 fallback | `npm view typescript dist-tags` ([ADR-009](17-adr.md#adr-009-typescript-702-with-a-603-fallback)) |
| Lint/format | @biomejs/biome | 2.5.14 | `npm view` |
| Audit hashing | canonicalize (RFC 8785 JCS) | 5.1.0 | `npm view` |
| Charts | d3-scale / d3-shape | 4.0.2 / 3.2.0 | `npm view` |
| LLM client | ollama (JS) | 0.6.3 (not used: plain `fetch` keeps one less dependency) | `npm view` |
| Database | PostgreSQL | 18.6 | `postgres --version` in `postgres:18` |
| Database | pgvector | 0.8.6 | image `pgvector/pgvector:0.8.6-pg18-trixie` |
| Containers | Docker Compose | v5.1.2 | `docker compose version` |
| LLM runtime | Ollama | 0.34.2 | `ollama --version` |
| Models | `qwen3.5:9b-mlx`, `embeddinggemma` (768-d) | local | `ollama list`; `/api/embed` length |

## 2. Official documentation consulted

| Topic | Source | Used in |
|-------|--------|---------|
| Vite guide, dev-server proxy | [vite.dev/guide](https://vite.dev/guide/) · [server options](https://vite.dev/config/server-options) | [08 §2](08-frontend-architecture.md#2-build-configuration) |
| Bun runtime, SQL client, test runner, workers, Docker | [bun.com/docs](https://bun.com/docs) · [Bun.sql](https://bun.com/docs/runtime/sql) · [bun test](https://bun.com/docs/test) · [Workers](https://bun.com/docs/runtime/workers) · [Docker guide](https://bun.com/docs/guides/ecosystem/docker) | [07](07-architecture.md), [14](14-test-strategy.md) |
| Docker Compose: file reference, watch, profiles | [Compose](https://docs.docker.com/compose/) · [services reference](https://docs.docker.com/reference/compose-file/services/) · [file watch](https://docs.docker.com/compose/how-tos/file-watch/) · [profiles](https://docs.docker.com/compose/how-tos/profiles/) | [07 §4](07-architecture.md#4-containers-c4-level-2-and-compose-topology) |
| PostgreSQL 18 release notes | [release-18](https://www.postgresql.org/docs/18/release-18.html) | [09 §10](09-database.md#10-pg18-features-used-and-their-pitfalls) |
| PostgreSQL RLS, views (`security_invoker`), generated columns, `uuidv7()`, temporal keys, `SKIP LOCKED` | [RLS](https://www.postgresql.org/docs/18/ddl-rowsecurity.html) · [CREATE VIEW](https://www.postgresql.org/docs/18/sql-createview.html) · [generated columns](https://www.postgresql.org/docs/18/ddl-generated-columns.html) · [UUID functions](https://www.postgresql.org/docs/18/functions-uuid.html) · [CREATE TABLE](https://www.postgresql.org/docs/18/sql-createtable.html) · [SELECT … FOR UPDATE](https://www.postgresql.org/docs/18/sql-select.html) | [09](09-database.md) |
| Postgres Docker image (PGDATA layout in 18) | [hub.docker.com/_/postgres](https://hub.docker.com/_/postgres) | EC-OPS-001 |
| pgvector (HNSW, cosine) | [github.com/pgvector/pgvector](https://github.com/pgvector/pgvector) | [11 §6](11-agent-llm.md#6-retrieval-rag) |
| Ollama API, tool calling, structured outputs, embeddings, thinking | [API](https://docs.ollama.com/api) · [tools](https://docs.ollama.com/capabilities/tool-calling) · [structured outputs](https://docs.ollama.com/capabilities/structured-outputs) · [embeddings](https://docs.ollama.com/capabilities/embeddings) · [thinking](https://docs.ollama.com/capabilities/thinking) | [11](11-agent-llm.md) |
| Models | [qwen3.5](https://ollama.com/library/qwen3.5) · [embeddinggemma](https://ollama.com/library/embeddinggemma) | [11 §5](11-agent-llm.md#5-runtime-topology-and-model-settings) |
| TanStack Router: overview, file routes, authenticated routes | [overview](https://tanstack.com/router/latest/docs/framework/react/overview) · [file-based routing](https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing) · [authenticated routes](https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes) | [08 §3–4](08-frontend-architecture.md#3-route-tree) |
| TanStack Query, Form, Table, Virtual | [Query](https://tanstack.com/query/latest/docs/framework/react/overview) · [Form](https://tanstack.com/form/latest/docs/overview) · [Table](https://tanstack.com/table/latest/docs/overview) · [Virtual](https://tanstack.com/virtual/latest/docs/introduction) | [08](08-frontend-architecture.md) |
| TanStack Start status (Release Candidate) | [Start overview](https://tanstack.com/start/latest/docs/framework/react/overview) | [ADR-002](17-adr.md#adr-002-vite-spa-with-tanstack-router-not-tanstack-start-or-nextjs) |
| Tailwind CSS 4: Vite plugin, `@theme`, dark mode | [Vite install](https://tailwindcss.com/docs/installation/using-vite) · [theme](https://tailwindcss.com/docs/theme) · [dark mode](https://tailwindcss.com/docs/dark-mode) | [06 §3](06-ui-design-system.md#3-tokens-tailwind-4-theme) |
| Hono: RPC client, streaming (SSE), validation | [docs](https://hono.dev/docs/) · [RPC](https://hono.dev/docs/guides/rpc) · [streaming](https://hono.dev/docs/helpers/streaming) · [validation](https://hono.dev/docs/guides/validation) | [07 §6](07-architecture.md#6-api-surface), [08 §6](08-frontend-architecture.md#6-data-access) |
| Zod 4 JSON Schema | [zod.dev/json-schema](https://zod.dev/json-schema) | [11 §4](11-agent-llm.md#4-tool-catalogue) |
| Playwright: intro, clock, accessibility, projects | [intro](https://playwright.dev/docs/intro) · [clock](https://playwright.dev/docs/clock) · [accessibility testing](https://playwright.dev/docs/accessibility-testing) · [projects](https://playwright.dev/docs/test-projects) | [14 §5](14-test-strategy.md#5-end-to-end-playwright) |
| fast-check, MSW, Biome, TypeScript | [fast-check](https://fast-check.dev/docs/introduction/) · [MSW](https://mswjs.io/docs/) · [Biome](https://biomejs.dev/guides/getting-started/) · [TypeScript](https://www.typescriptlang.org/docs/) | [14](14-test-strategy.md), [17](17-adr.md) |
| Problem details (RFC 9457), JSON canonicalisation (RFC 8785) | [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) · [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) | [07 §8](07-architecture.md#8-cross-cutting-concerns), [09 §7](09-database.md#7-audit-trail-append-only-and-hash-chained) |
| WCAG 2.2 | [w3.org/TR/WCAG22](https://www.w3.org/TR/WCAG22/) | [04 §8](04-ux-ia-flows.md#8-accessibility-wcag-22-aa), [06](06-ui-design-system.md) |
| Cookies, CSRF, password storage | [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) · [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) · [OWASP passwords](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) | [07 §10](07-architecture.md#10-security) |
| Options risk disclosure (ODD) | [OCC Options Disclosure Document](https://www.theocc.com/company-information/documents-and-archives/options-disclosure-document) (returns 403 to automated clients; open in a browser) | [02](02-investment-domain.md), [12](12-compliance-copy.md) |
| HK profits tax (IRO s.14 context) | [IRD profits tax](https://www.ird.gov.hk/eng/tax/bus_pft.htm) | [12 §6](12-compliance-copy.md#6-hong-kong-tax-journal-educational) |
| Product needs (source of truth) | [`../Needs/`](../Needs/) | all |

## 3. Verification log

All runs on 2026-09-23, macOS (Apple Silicon), Docker Desktop, container `pgvector/pgvector:0.8.6-pg18-trixie`.

| # | What | Command / method | Result |
|---|------|------------------|--------|
| V-01 | Baseline DDL applies on PG 18.6 | `psql -v ON_ERROR_STOP=1 < 001_init.sql` on a fresh database | OK |
| V-02 | Behaviour checks as `edge_app` (NOSUPERUSER, NOBYPASSRLS) | `psql < verify_behaviour.sql` | **31/31 PASS** (re-run after the `source` CHECK change for ADR-014) |
| V-03 | Plain views bypass RLS | same data; a plain view vs a `security_invoker` view, read as user B | plain view: B sees **1** row of A; invoker view: **0** rows ⇒ EC-DB-011 fix |
| V-04 | Concurrency race on `lots_max = 1` | two concurrent sessions insert a first cycle for the same user, each holding its transaction for 1 s | one commits; the other fails `LOTS_EXCEEDED: open=1 max=1`; 1 open cycle (EC-WH-003) |
| V-05 | Audit chain verify query ([09 §7](09-database.md#7-audit-trail-append-only-and-hash-chained)) | 3 events, verify; superuser tampers `payload_hash` of seq 2; verify again | before: no break; after: `first_broken_seq = 2` (EC-DB-006) |
| V-06 | Domain core | `bun test` in the domain spike (Bun 1.4.2, zod 4.6.5, fast-check 4.10.2) | **31/31 pass**, 59 expects, 245 ms |
| V-07 | LLM as a rule engine (5 runs per case, `qwen3.5:9b-mlx`, JSON schema, `think:false`) | Ollama `/api/chat` with the rules in the system prompt | wrong side + MKT blocked 3/3; HKD loan 5/5; **cash short passed 3/5**; **valid draft blocked 4/5**; **12.22% OTM passed 2/5** ⇒ FP-11 |
| V-08 | LLM tool calling | `calc_invariants` tool offered, "break-even of 650 P @ 12.40?" ×5 | tool called 4/5 with correct typed args; 1/5 answered from memory ⇒ citation guard ([11 §7](11-agent-llm.md#7-citation-guard)) |
| V-09 | Embedding size | `/api/embed` with `embeddinggemma` | 768 dimensions = `vector(768)` |
| V-10 | Compose file from [07 §4.1](07-architecture.md#41-composeyaml-normative) | `docker compose config -q` with a dummy `.env`; `--profile linux-gpu`; without `.env` | valid; profile adds `ollama`; missing secret fails with "set in .env" |
| V-11 | Dockerfile from [07 §4.2](07-architecture.md#42-dockerfile-multi-stage-one-image-family-many-targets) | `docker build --check .` | "Check complete, no warnings found." |
| V-12 | Versions in §1 | `npm view`, binaries | all match |
| V-13 | TanStack Start maturity | official overview page | "currently in the Release Candidate stage" |
| V-14 | Documentation links in §2 | `curl -L` status per URL | all 200 except OCC (403 to bots) |
| V-15 | Temporal PK overlap (PG18 `WITHOUT OVERLAPS`) | part of V-02 | "conflicting key value violates exclusion constraint" |
| V-16 | Monte Carlo speed (10k paths × 20 quarters) | spike timing | 10–25 ms locally ([10 §8](10-simulation-engines.md#8-execution-model)) |
| V-17 | Colour contrast of tokens | WCAG relative-luminance formula on each pair | values in [06 §3](06-ui-design-system.md#3-tokens-tailwind-4-theme); `line` 2.56:1 is decorative only |

## 4. Not yet verified (tracked in the plan)

| Item | Why not yet | Where it gets verified |
|------|-------------|-------------------------|
| TypeScript 7.0.2 with every tool in the chain | No application code yet | F0-T1 ([15](15-implementation-plan.md#f0-walking-skeleton-35-days)) |
| Playwright journeys and axe on real screens | Screens not built | E0 onward |
| Performance budgets on CI hardware | No CI yet | Hardening |
| Golden and red-team LLM suites at scale (60 + 20 cases) | Only probes so far | E8-T6 |

---

## Cross-references

[00 FP-11](00-why-first-principles.md#3-first-principles-truths-that-must-hold) · [09 Database](09-database.md) · [11 Agent](11-agent-llm.md) · [14 Tests](14-test-strategy.md) · [17 ADRs](17-adr.md)
