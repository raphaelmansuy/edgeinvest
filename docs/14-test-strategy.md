# 14 · Test strategy (Full-stack + QA lens)

> Tools: `bun test` (unit, integration), **fast-check 4.10.2** (properties), **@playwright/test 1.63.0** + **@axe-core/playwright 4.13.0** (e2e, a11y),
> **msw 2.15.0** (front-end component tests). Versions: [18 §1](18-references.md#1-stack-versions-verified-2026-09-23).

---

## 1. WHY (testing lens)

The product's promise is "the numbers are right and nothing unsafe gets through". Both halves are testable facts, so every first principle
([00 §3](00-why-first-principles.md#3-first-principles-truths-that-must-hold)) and every edge case ([13](13-edge-cases.md)) gets an executable check,
and CI refuses to merge if one is missing ([§6](#6-traceability-gate-ci)).

## 2. Pyramid and ownership

```
                         ▲ slower, fewer
            ┌────────────────────────────┐
            │ L  LLM eval (nightly)      │  real Ollama · golden + red team            ~80 cases
            ├────────────────────────────┤
            │ E  Playwright e2e          │  registry sweep (46 routes) + 6 journeys    ~120 tests
            ├────────────────────────────┤
            │ C  API contract            │  Hono app.request(), real PG, RFC 9457      ~150 tests
            ├────────────────────────────┤
            │ I  Integration (real PG18) │  constraints, RLS, triggers, races, jobs    ~90 tests
            ├────────────────────────────┤
            │ U/P Unit + property        │  domain, sim, guards, copy lint, FE hooks   ~400 tests
            └────────────────────────────┘
                         ▼ faster, more
```

| Package | Level | Coverage bar | Owner lens |
|---------|-------|--------------|-----------|
| `packages/domain` | U + P | 100% branches on rules, invariants, transitions | Investment |
| `packages/sim` | U + P | parity/bounds/reproducibility properties | Investment |
| `packages/contracts` | U | schema snapshots; error catalogue complete | Full stack |
| `apps/api` | C + I | every route: happy, auth, RLS, idempotency, problem shape | Full stack + DB |
| `db/` | I | every CHECK/trigger/policy in [09 §9](09-database.md#9-constraint-catalogue--edge-cases) | DB |
| `apps/web` | U (hooks, MSW) + E | every screen state in [04 §6](04-ux-ia-flows.md#6-states-every-screen-must-design-test-fixture) | UX + Front |
| agent | U (FakeLlm) + L | guards, registry, citation | Agent |
| content | U | schema, MC/C tags, verbatim copy hashes | Game + Compliance |

## 3. Unit and property tests

- Test titles start with IDs: `test("[EC-CS-001][US-3] cash short of reserve", …)`. The trace gate reads these tags.
- Fixtures are the worked examples in [02 §3](02-investment-domain.md#3-worked-examples-these-exact-numbers-are-test-fixtures) and the running example in [05](05-screens-wireframes.md) (650P, fill 12.35, basis 637.65).
- Properties (fast-check, 1,000 runs, seed printed on failure):

```ts
fc.assert(fc.property(arbStrike, arbPremiumBelow, arbQty, (K, p, q) => {
  const r = shortPutInvariants({ strike: K, premium: p, qty: q });
  return r.worstCase === r.reserve - r.maxProfit && r.breakEven > 0 && r.breakEven < K;
}), { numRuns: 1000 });
```

- Clock: domain takes `now` as an argument; tests pin `2026-09-23T07:00+08:00` (HKT morning = previous ET day) and the DST dates (EC-TM-001/002).
- Rule registry: a table-driven test builds one failing context per rule and asserts exactly that reason code (Open/Closed: a new rule adds one row).

## 4. Integration tests (real Postgres)

Real **PostgreSQL 18.6** in Docker; no mocks for SQL. The spike's `verify_behaviour.sql` (31/31 PASS) becomes the seed of this suite.

```
 bun test --preload ./test/pg.ts
   globalSetup: compose -f compose.test.yaml up -d db (tmpfs, fsync=off)
                migrate once into database  edge_template
   per test file: CREATE DATABASE t_<file> TEMPLATE edge_template   (~40 ms)
   per test:      BEGIN … ROLLBACK        (unless it tests commit-time behaviour)
   teardown:      DROP DATABASE t_<file>
```

| Area | Examples | Notes |
|------|----------|-------|
| Constraints | wrong side, crossed quote, NULL-passing CHECKs, odd lots | assert SQLSTATE + constraint name |
| RLS | user B reads A's tables **and views** ⇒ 0 rows; no `app.user_id` ⇒ 0 rows | run as `edge_app` (NOBYPASSRLS) |
| Triggers | illegal transition, halt guard, append-only audit, hash chain | assert error message prefix mapped in 07 §8.1 |
| Races | two sessions open a first lot concurrently ⇒ exactly one succeeds | two connections, barrier, `Promise.allSettled` |
| Jobs | SKIP LOCKED: two workers never take the same job; reaper resets stuck jobs | EC-OPS-002 |
| Migrations | checksum drift refused; fresh migrate == template | EC-OPS-006 |
| Catalogue | every view has `security_invoker=true`; every user table has RLS enabled + forced | queries on `pg_class` |

```ts
test("[EC-WH-003] concurrent first lots: exactly one wins", async () => {
  const [a, b] = [connectAs(userA), connectAs(userA)];
  const results = await Promise.allSettled([openCycle(a), openCycle(b)]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(String((results.find(r => r.status === "rejected") as PromiseRejectedResult).reason)).toMatch(/LOTS_EXCEEDED/);
});
```

## 5. End-to-end (Playwright)

```
 compose -f compose.yaml -f compose.test.yaml up --wait     (db, migrate, api, worker, web; AGENT_PROVIDER=fake)
 playwright projects: desktop-chromium · mobile (390×844) · dark · webkit (smoke only)
 globalSetup: seed personas via SQL as edge_owner   (no test-only HTTP endpoints exist in the image)
```

**Registry sweep** (one spec, 46 routes, DRY with [05 §1](05-screens-wireframes.md#1-screen-registry)):

```ts
for (const scr of SCREENS) test(`[${scr.id}] renders, guards, banner, a11y, copy`, async ({ page, as }) => {
  await as(personaFor(scr.guard));                          // user who satisfies the guard
  await page.goto(sampleUrl(scr));
  await expect(page.getByTestId("compliance-banner")).toHaveAttribute("data-mode", scr.banner);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.filter(v => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  expect(renderedCopyLint(await page.locator("body").innerText())).toEqual([]);   // 12 §5
  await as(personaMissing(scr.guard)); await page.goto(sampleUrl(scr));
  await expect(page).toHaveURL(redirectFor(scr.guard));      // guard works
});
```

**Journeys** (each step asserts UI **and** the audit event):

| ID | Journey | Stories | Key assertions |
|----|---------|---------|----------------|
| J1 | Sign in → first run → acks → Learn | AUTH-1, US-1 | redirect until acked; `disclosure_acked` |
| J2 | Inputs → snapshot → candidates → packet (crash + MC) → draft → coach → human gate → fill | US-3, US-4, US-5, US-9, US-10 | five numbers before rank; blocked draft shows reasons; basis 637.65 |
| J3 | Assigned → willingness → call packet → call draft → called away | US-8 | locked-loss veto path; ledger rows |
| J4 | HKD loan → halt → clear refused (409) → fix → clear | US-8 | `HALT_CONDITION_PERSISTS`; banner in `aria-live` |
| J5 | Skip with reason → history → quarterly ledger → HK CSV | US-6, US-7 | skip not penalised; CSV header disclaimer |
| J6 | Agent offline and online (FakeLlm) | US-5, US-12 | offline banner; same verdicts; drill locked on graded |

Determinism: `page.clock.install({ time: new Date("2026-09-23T07:00:00+08:00") })` for the browser. The API reads `X-Test-Now`
only when started with `EDGE_TEST_CLOCK=1`, which the production target cannot set (the Dockerfile `api` target has no such env and the flag
is refused when `NODE_ENV=production`).

**No-submit probes** (EC-SEC-008): `POST /api/v1/orders/*` ⇒ 501; the built bundle contains no IBKR host names or `placeOrder`.

## 6. Traceability gate (CI)

```
 docs/13-edge-cases.md  ─┐  IDs: EC-*          ┌─ test titles: [EC-…] [US-…] [SCR-…]
 docs/01-product-spec.md ─┼─► tools/trace.ts ◄─┤  (bun test --reporter=junit, playwright json)
 packages/contracts/screens.ts ┘  IDs: US-*, SCR-*  └─ SQL checks: "-- [EC-…]"
            │
            ├─ missing: ID in docs, no test               ⇒ FAIL
            ├─ dangling: tag in a test, ID not in docs     ⇒ FAIL
            ├─ skipped: test tagged but .skip / .fixme     ⇒ FAIL on main
            └─ writes docs/16-traceability.generated.md     (diffed in the PR)
```

The gate runs after all suites, on the JSON reports, so it counts **executed** tests, not written ones.

## 7. LLM evaluation

| Suite | When | Provider | Pass bar |
|-------|------|----------|----------|
| Guards and registry (EC-AG-001/003/006/007) | every PR | FakeLlm | 100% |
| Golden set (60 cases: expected tool calls + required facts) | nightly | Ollama `qwen3.5:9b-mlx` | tool-call ≥ 90%; citation coverage ≥ 95% |
| Red team (20 cases, [11 §12](11-agent-llm.md#12-evaluation)) | nightly | Ollama | 100% refused or guarded |
| Verdict agreement (informational) | nightly | Ollama | reported, never gating; code decides |

Nightly results are stored as JSON with `model digest`, `prompt_version` and `copy_version`; a drop of more than 5 points opens an issue.

## 8. API contract tests

In-process `app.request()` against a real test database. Every route gets: happy path, 401, capability 403, foreign id 404 (RLS), Zod 400/422
with RFC 9457 body (`type`, `title`, `status`, `code`, `traceId`), Idempotency-Key replay and mismatch, ETag `STALE_WRITE`.
The Hono RPC types are compiled in the web package, so a breaking change fails `tsc` before any test runs.

## 9. Non-functional checks

| Check | Tool | Bar |
|-------|------|-----|
| Performance budgets ([07 §12](07-architecture.md#12-performance-budgets)) | bun bench + Playwright traces | p95 within budget on CI hardware |
| Accessibility | axe (all routes) + keyboard journeys J2/J4 | 0 serious/critical |
| Security headers, CSRF, cookies | contract tests | all pass |
| Dependencies | `bun audit`, gitleaks | no high/critical |
| Copy | `bun run lint:copy` + rendered lint | 0 violations |

## 10. CI pipeline

```
 PR ─► biome check ─► tsc -b ─► lint:copy ─► bun test (U/P) ─► bun test (I, C; PG18 service) ─► vite build
     ─► docker build (targets) ─► compose up ─► playwright (E) ─► trace gate ─► ✓ merge
 nightly ─► all of the above + LLM eval (self-hosted macOS runner with Ollama) + restore test (EC-OPS-005)
```

## 11. Flake policy

No retries on unit, integration or contract tests. Playwright gets `retries: 1` on CI **and** a failing-then-passing test is reported as flaky
and must be fixed within a week. Waits use web-first assertions only (`expect(locator).toBeVisible()`), never `waitForTimeout`.

---

## Cross-references

[13 Edge cases](13-edge-cases.md) · [15 Plan](15-implementation-plan.md) · [16 Traceability](16-traceability.md) · [09 Constraints](09-database.md#9-constraint-catalogue--edge-cases) · [11 Evaluation](11-agent-llm.md#12-evaluation)
