# 15 · Implementation plan (everyone)

> Epics follow the Needs backlog E0–E9 ([PRD §7.2](../Needs/1%20PRD%20%28deanpeters%20structure%29/PRD.md)), preceded by a walking skeleton **F0**.
> Each epic is a **vertical slice**: migration → domain → use case → route → screen → e2e. It is done only when the Definition of Done ([§3](#3-definition-of-done)) holds.
> Task IDs `En-Tn` are referenced in PRs and commit messages.

---

## 1. WHY (plan lens)

The riskiest things are not the screens. They are **the numbers**, **the gates**, and **the absence of a submit path**. So the plan builds the
proof machinery first (F0: CI, trace gate, registry, real Postgres), puts the domain core in early (already spiked, 31/31), and makes every
later slice ride on the same rails. Nothing ships that the traceability gate cannot see.

## 2. Principles applied to the plan

| Principle | How the plan applies it |
|-----------|-------------------------|
| First principles ([00](00-why-first-principles.md)) | FP-1…FP-11 each get a test in the epic that introduces them; F0 lists them as pending in the trace report |
| DRY | One source per fact: Zod contracts, screen registry, rule registry, copy module, error catalogue, envelope table. No epic may duplicate one |
| S (single responsibility) | Use case = one business action; route files only map HTTP ⇄ use case |
| O (open/closed) | New rule = new registry entry + one table row test; evaluator untouched |
| L (Liskov) | `FakeLlm`, `FixedClock`, `InMemoryAudit` pass the **same** port contract tests as real adapters |
| I (interface segregation) | Small ports: `Clock`, `AuditLog`, `MarketDataPort`, `Llm`, `UnitOfWork` |
| D (dependency inversion) | Use cases receive ports; only `apps/api/src/main.ts` wires adapters |
| Tests first where the risk is | Domain and DB rules are written test-first from [13](13-edge-cases.md); screens are built against the state fixture ([04 §6](04-ux-ia-flows.md#6-states-every-screen-must-design-test-fixture)) |

## 3. Definition of Done

A task or epic is done when **all** of these hold:

```
 [ ] Every story/edge case in scope has an executed test tagged with its ID (trace gate green)
 [ ] Unit + property + integration + contract + e2e suites green; no .skip/.fixme on main
 [ ] Screen: all states from 04 §6 designed and tested; axe 0 serious/critical; keyboard path works
 [ ] Copy: strings come from packages/copy; lint:copy + rendered lint green; banner matches registry
 [ ] API: Zod in/out; RFC 9457 errors with catalogue codes; Idempotency-Key on mutations; RLS test for foreign ids
 [ ] DB: forward-only migration; constraint ↔ EC row added to 09 §9; views security_invoker
 [ ] Audit: every state change writes its audit event in the same transaction
 [ ] No new path to order submission (no-submit probes green)
 [ ] Docs updated where behaviour changed (the spec is the contract; drift is a bug)
```

## 4. Dependency graph

```
 F0 skeleton ──► E0 auth+shell ──► E1 invariants+learn ──► E2 envelope+wheel state
                                                                  │
                          ┌───────────────────────────────────────┤
                          ▼                                       ▼
                 E3 inputs+put packet+skip ──────────► E4 crash+MC+backtest
                          │                                       │
                          └───────────────┬───────────────────────┘
                                          ▼
                                  E7 execute (put): drafts, rules, coach, human gate, fill, lifecycle, halt
                                          │
                       ┌──────────────────┼──────────────────┐
                       ▼                  ▼                  ▼
               E6 share phase      E5 game + mastery    E9 ledger, HK export, audit verify
               (calls, SCR-034–039) (needs E1–E4 domain)       │
                       │                  │                  │
                       └──────────────────┴────────┬─────────┘
                                                   ▼
                                           E8 agent (Ask/Ticket/Packet/Drill)
```

The order differs from the Needs list in one place: **E7 (put side) comes before E5/E6**. Assignment, calls and the paper lab all need
drafts, fills and lifecycle events to exist. The Needs' "E7 Execute" is split into E7a (put) and E7b (call), the latter delivered with E6.

## 5. Timeline (one developer with an AI pair; ideal weeks)

```
 week        1    2    3    4    5    6    7    8    9    10   11   12
 F0        ████                                                            MVP-α
 E0          ████                                                          (F0–E4)
 E1             ████
 E2                ███
 E3                  ██████
 E4                     █████
 E7a                          ██████                                       MVP-β
 E6 + E7b                          ██████                                  (E5–E7)
 E5                                 █████
 E9                                        ████                            MVP-γ
 E8                                          ██████                        (E8–E9)
 hardening                                         ███████
 milestones           ▲α-demo                 ▲β full paper wheel          ▲γ red team + a11y
```

Estimates are ranges in the epic tables; the chart shows the midpoint. The Needs' "week 1–2" for E0–E9 is not realistic with the tests required here, and this plan does not pretend otherwise.

## 6. Epics

### F0 Walking skeleton (3–5 days)

| Task | Deliverable | Proves |
|------|-------------|--------|
| F0-T1 | Bun workspaces monorepo ([07 §5](07-architecture.md#5-monorepo-and-dependency-rules)); `tsconfig.base.json`; Biome 2.5 | import rules test |
| F0-T2 | `compose.yaml` + `Dockerfile` exactly as [07 §4](07-architecture.md#4-containers-c4-level-2-and-compose-topology); `docker compose config` in CI | EC-OPS-001 |
| F0-T3 | `db/migrations/001_init.sql` from the appendix; Bun migrator with checksums | EC-OPS-006 |
| F0-T4 | Move `docs/appendix/domain-spike` into `packages/domain` + `packages/sim`; keep its 31 tests green | FP-1, FP-10 |
| F0-T5 | Port `verify_behaviour.sql` into `bun test` integration suite (31 checks) | EC-DB-*, EC-SEC-002 |
| F0-T6 | `packages/contracts/screens.ts` (46 entries) + generated route stubs; registry sweep e2e (renders placeholders) | EC-UX-004 |
| F0-T7 | Trace gate `tools/trace.ts` reading 13/01/registry; report committed | [14 §6](14-test-strategy.md#6-traceability-gate-ci) |
| F0-T8 | `/orders/*` 501 route + bundle grep | EC-SEC-008 |
| F0-T9 | CI pipeline ([14 §10](14-test-strategy.md#10-ci-pipeline)); nightly job placeholder | – |

Exit: `docker compose up --wait` then `bunx playwright test` passes with 46 placeholder routes; the trace report lists every EC as "missing" except the ported ones.

### E0 Auth, shell, phase chrome (4–6 days) · AUTH-1 · SCR-100, 101, 000, 070, 073

| Task | Deliverable |
|------|-------------|
| E0-T1 | `SignIn/SignOut` use cases; argon2id; `__Host-sid` sessions; rate limit (EC-SEC-001/003) |
| E0-T2 | CSRF header + Origin check; security headers (EC-SEC-004/005) |
| E0-T3 | UoW with `set_config('app.user_id')` + audit in the same transaction (EC-DB-005) |
| E0-T4 | `GET /me/capabilities`; `_app.beforeLoad` guard; `guardFor(scr)` (EC-UX-005) |
| E0-T5 | Disclosure ack flow + `ComplianceBanner` from registry (EC-CP-001/005) |
| E0-T6 | Shell chrome: phase, lots, reserved/leftover (from `v_wheel_summary`), envelope chip, mode chip |

Exit: journey J1 green; registry sweep asserts guards and banners.

### E1 Invariants and curriculum (5–7 days) · US-1 · SCR-001–006, 004, 020

| Task | Deliverable |
|------|-------------|
| E1-T1 | `POST /calc/invariants`, `POST /sim/payoff` (pure) (EC-IV-*, EC-MN-*) |
| E1-T2 | `TicketThreeNumbers` + `WorstCaseLine`, DOM order before any score (EC-UX-001) |
| E1-T3 | Content package: M1–M5 modules, quiz generators with seeded variants, Zod schema (EC-LN-002/006) |
| E1-T4 | `POST /quiz/:module/attempts` server grading; evidence rows (C-VOC, C-ARITH) (EC-LN-001) |

### E2 Envelope, mastery stub, wheel state (3–4 days) · US-2 · SCR-071, 003

| Task | Deliverable |
|------|-------------|
| E2-T1 | Envelope table + temporal history; boot hash check (EC-EN-003/004, EC-DB-002) |
| E2-T2 | `PATCH /me/envelope` with mastery capability and audited override phrase (EC-EN-002) |
| E2-T3 | `wheel_state` + `wheel_cycle_guard` (lots_max = 1, halt) + race test (EC-WH-003/006) |

### E3 Inputs, put packet, Skip (6–8 days) · US-3 (partial), US-7, US-9, US-11 · SCR-102, 030–033

| Task | Deliverable |
|------|-------------|
| E3-T1 | Capture account / market / rate snapshots with cite-or-refuse (EC-MD-003/005/006/008, EC-CS-004) |
| E3-T2 | Candidate generation + scoring; reject reasons incl. `WIDE_SPREAD`, `NO_BID`, hurdle (EC-MD-001/004, EC-PK-002) |
| E3-T3 | Memo lifecycle; pre-commitment field; Skip as primary action (EC-PK-004/006, EC-UX-002) |
| E3-T4 | Rule changes from the spike: **R-OTM and R-PACKET apply to puts only; R-CASH subtracts open reserves; `severity` field; new R-TICK, R-STALE, R-ACCT, R-HALT, R-MODE, R-ALLOW, R-EXDIV, R-ITM** ([02 §8](02-investment-domain.md#8-draft-checklist-rules)) |
| E3-T5 | History with keyset pagination (EC-PK-005) |

### E4 Crash, Monte Carlo, backtest (5–7 days) · US-3 · SCR-020–023

| Task | Deliverable |
|------|-------------|
| E4-T1 | Crash library `crash-lib-v1`; `POST /sim/crash`; attach to memo with input-hash check (EC-SM-005, EC-PK-003) |
| E4-T2 | MC in a Bun Worker with 2 s timeout and caps; immutable `stress_result` (EC-SM-001/003/004, EC-DB-007) |
| E4-T3 | `fill_cash` only in simulators; acceptance: dotcom_2000 worse than one lot (EC-SM-006) |
| E4-T4 | Backtest job (SKIP LOCKED) + reaper; dataset manifest hashes (EC-SM-007/008, EC-OPS-002) |
| E4-T5 | `ClaimLabel`, `sim.not_forecast`, `YieldStack` (two legs) (EC-CP-002) |

Exit MVP-α: J2 up to "packet complete" green.

### E7a Execute: put side (7–9 days) · US-4, US-5, US-10, US-11 · SCR-040–042, 103, 045

| Task | Deliverable |
|------|-------------|
| E7-T1 | `PrepareDraft` runs the registry; 201 open/blocked; DB CHECKs (EC-DR-001…003) |
| E7-T2 | Put playbook steps; Paper SIM bar step; halt `paper_bar_missing` (EC-DR-005) |
| E7-T3 | Draft coach with rule results (agent slot empty until E8) |
| E7-T4 | Human gate idempotent; Live re-ack (EC-DR-006, EC-CP-003) |
| E7-T5 | `RecordFill` (actual price, qty) → cycle, leg, ledger (EC-DR-007, EC-LG-002) |
| E7-T6 | Short-put life: expired, bought back, rolled, assigned early/at expiry (EC-WH-001/002/007) |
| E7-T7 | Halt screen: raise, clear with re-evaluation (409), locked-loss veto phrase (EC-WH-006) |

### E6 + E7b Share phase and call side (7–9 days) · US-8 · SCR-034–039, 043, 044

| Task | Deliverable |
|------|-------------|
| E6-T1 | Assignment confirmation; decision basis with roll credits (EC-WH-009) |
| E6-T2 | Willingness check; halt `willingness_declined` |
| E6-T3 | Call candidates/packet (crash optional); R-BASIS, R-EXDIV, R-ITM (EC-WH-004/008/010, EC-IV-004) |
| E6-T4 | Call playbook + short-call life; called away closes the cycle; put lock screen |

Exit MVP-β: J3 and J4 green: a full paper wheel.

### E5 Serious game and mastery (6–8 days) · US-1, US-3, US-7, US-8 · SCR-007–012

| Task | Deliverable |
|------|-------------|
| E5-T1 | Mastery projection from evidence; unlock rules; DB CHECK (EC-LN-003/004) |
| E5-T2 | Tutorial, scenario, crash (no timers), committee modes; process scoring, outcome weight 0 (EC-LN-005) |
| E5-T3 | Paper lab replaying `packages/domain` inside `game_attempt.decisions` (EC-LN-007) |
| E5-T4 | Misconception remediation cards MC-01…MC-10; anti-casino copy lint CP-CASINO |

### E9 Ledger, HK export, audit (4–5 days) · US-6 · SCR-046, 050–052

| Task | Deliverable |
|------|-------------|
| E9-T1 | Quarterly ledger + HK YoA views; no annualising one quarter (EC-LG-001/003/005) |
| E9-T2 | HK tax journal, badges-of-trade notes, CSV with header disclaimer (EC-CP-004) |
| E9-T3 | Audit list + `GET /audit/verify` (EC-DB-006, EC-SEC-007) |
| E9-T4 | Backup script + restore drill (EC-OPS-005) |

### E8 Agent (6–8 days) · US-5, US-12 · SCR-060, drawer

| Task | Deliverable |
|------|-------------|
| E8-T1 | `LlmPort` with `OllamaLlm` + `FakeLlm`; status endpoint; offline banner (EC-AG-008) |
| E8-T2 | Tool registry from Zod; executor over existing use cases with `actor='agent'` (EC-AG-001/006) |
| E8-T3 | Guards: advice, guarantee, voice, CTA, citation (EC-AG-002/003/004/007) |
| E8-T4 | RAG: chunking, `embeddinggemma` 768-d, hybrid RRF search, re-embed job (EC-AG-012) |
| E8-T5 | SSE streaming + abort; rate limits; drill lock (EC-AG-009/010/011) |
| E8-T6 | Nightly golden + red-team suites (EC-AG-005) |

Exit MVP-γ: red team 100%, trace gate green with zero missing IDs, axe clean on all 46 routes.

### Hardening (1–2 weeks)

Performance budgets, dark mode audit, mobile layouts, dependency audit, copy review with the compliance owner, restore drill, OPEN-1…7 decisions.

## 7. Risk register

| Risk | Likelihood | Impact | Mitigation | Owner epic |
|------|-----------|--------|------------|-----------|
| TypeScript 7.0 native compiler incompatibility with a tool | Medium | Medium | Pin 7.0.2; fallback 6.0.3 documented in [17 ADR-009](17-adr.md#adr-009-typescript-702-with-a-603-fallback) | F0 |
| Local model quality varies by version | High | Low (advisory only) | Code decides; nightly eval; model digest recorded | E8 |
| Scope creep into broker integration | Medium | High | ADR-005; no broker port exists | all |
| Game feels like homework | Medium | Medium | Efficacy metrics in [03 §11](03-serious-game-design.md#11-how-we-will-know-the-game-works); short loops | E5 |
| Data vendor question (OPEN-2) blocks backtest | Low | Medium | BS proxy with `unconfirmed` label | E4 |

---

## Cross-references

[01 Release slices](01-product-spec.md#8-release-slices) · [13 Edge cases](13-edge-cases.md) · [14 Tests](14-test-strategy.md) · [16 Traceability](16-traceability.md) · [17 ADRs](17-adr.md)
