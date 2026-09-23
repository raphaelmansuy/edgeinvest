# 19 · Glossary (everyone)

> One meaning per term, used the same way in code, copy and docs. Code identifiers are in `backticks`. If a term is missing here, add it before using it in a PR.

---

## 1. WHY

Most wheel mistakes start as vocabulary mistakes: "basis" meaning two things, "yield" hiding two legs, "paper" meaning the IBKR account or the game.
This page fixes the words so the numbers can be trusted.

```
 strike K ─┬─► reserve = K × 100 × q ───────────────┐
 premium p ┼─► max profit = p × 100 × q ─────────────┼─► worst case = reserve − max profit
 qty q ────┴─► break-even = K − p                    │
                   │                                  │
             assigned? ─► decision basis B = K − net put credits per share ─► covered call rule: Kc ≥ B (else locked loss)
```

## 2. Options and the wheel

| Term | Meaning | See |
|------|---------|-----|
| Cash-secured put (CSP) | Selling a put while holding enough **settled USD** to buy the shares if assigned | [02 §2](02-investment-domain.md#2-invariants-the-five-numbers) |
| Wheel | Cycle: short put → (assigned) shares held → covered call → (called away) cash | [02 §4](02-investment-domain.md#4-the-wheel-state-machine) |
| Lot / cycle | One 100-share commitment (`wheel_cycle`); `lots_max` = 1 by default | [02 §6](02-investment-domain.md#6-sizing-lots-and-willingness) |
| Strike (K), premium (p), qty (q) | Contract terms; q in contracts, multiplier 100 | – |
| Reserve | K × 100 × q: cash held against assignment | FP-2 |
| Max profit | p × 100 × q before fees | – |
| Break-even | K − p per share | – |
| Worst case | Reserve − max profit (the underlying goes to zero) | FP-1 |
| The five numbers | Reserve, max profit, break-even, worst case, cost basis | US-1 |
| DTE | Days to expiry on the **US/Eastern** calendar | EC-TM-001 |
| OTM / ITM | Out of / in the money; for puts OTM% = (spot − K) / spot | – |
| Assignment | Being required to buy (put) or sell (call) shares; can happen **any day** (American style) | EC-WH-007 |
| Called away | Shares sold at the call strike on assignment | – |
| Decision basis (B) | K − (Σ put credits − Σ buy-to-close debits) / (100·q); used for the call rule. May differ from the broker's figure | EC-WH-009 |
| Locked loss | Covered call with Kc < B: max outcome is a loss; needs a typed veto on SCR-045 | EC-WH-004 |
| Roll | Buy to close and sell a new contract; both legs recorded | – |
| Ex-dividend risk | Early call exercise before an ex-dividend date | EC-WH-008 |
| Pin risk | Spot near the strike at expiry; outcome unknown until the broker notice | EC-WH-002 |
| Chain, bid, ask, mid, spread | Quotes for a contract; default limit = bid; spread > 10% of mid ⇒ reject | EC-MD-004 |
| Penny tick | QQQ options trade in 0.01 increments | `R-TICK` |
| Settled cash / NLV | Cash usable now vs net liquidation value; only settled USD counts | EC-CS-003 |
| FX loan | Any negative currency balance (e.g. HKD) = borrowing ⇒ halt | EC-CS-002 |
| Options level | IBKR permission level; puts need Level 3 | `R-LEVEL` |

## 3. Strategy and decisions

| Term | Meaning | See |
|------|---------|-----|
| Envelope | Allowed OTM and DTE bands: `beginner_v1` 5–12% / `mentor_cyrille_v1` 16–30%, both 60–120 DTE | [02 §5](02-investment-domain.md#5-strategy-envelopes) |
| Mastery | All competencies passed from evidence; unlocks Mentor and Live | [03 §4](03-serious-game-design.md#4-evidence-model-how-mastery-is-measured) |
| T-bill hurdle | Reject when premium yield (annualised) < risk-free rate `r` | [02 §7](02-investment-domain.md#7-the-t-bill-hurdle-and-the-stack) |
| Premium yield (annualised) | (p / K) × 365 / DTE. Always shown next to, never added to, the T-bill leg | G15 |
| Candidate score | (yield − r) − 0.5 × spread / mid; a tie-breaker inside the envelope, not advice | [02 §10](02-investment-domain.md#10-candidate-generation-and-scoring) |
| Memo / packet | Decision record (`decision_memo`) with candidates, stresses and a decision; "packet complete" = crash + MC attached (derived) | [09 §3](09-database.md#3-derive-dont-store) |
| Skip | A first-class decision with a reason code; never penalised | US-7 |
| Pre-commitment | Written plan for a −20% move, required for a `sell` decision | US-11 |
| Draft | A ticket preview (`draft_preview`) with rule results: `open` or `blocked` | [02 §8](02-investment-domain.md#8-draft-checklist-rules) |
| Rule / reason code | `R-*` registry entry; failing block rule adds a code like `CASH_NOT_SECURED` | [02 §8](02-investment-domain.md#8-draft-checklist-rules) |
| Halt | Account-level stop (`fx_loan`, `level_gap`, `second_lot_without_cash`, `willingness_declined`, `paper_bar_missing`); clearing re-checks the cause | EC-WH-006 |
| Veto | Draft-level override by typed phrase (locked-loss accept) | SCR-045 |
| Willingness cap | Max lots the user says they would hold as shares | SCR-035 |
| `fill_cash` | Size to all cash; exists only in simulators to show the danger | EC-SM-006 |
| Human gate | The user places the order in IBKR; the app records "submitted by user" | FP-5 |
| Playbook / coach | Step-by-step IBKR Mobile instructions (SCR-040/043); draft coach = rule review (SCR-041) | US-4 |
| Paper mode / Live mode | Which **IBKR account** the user trades in; Paper is default | SCR-072 |
| Paper lab | A **game mode** replaying the domain over `game_attempt.decisions`; never writes real wheel rows | ADR-014 |
| Fill | Actual execution price and qty recorded on SCR-103; basis uses the fill, not the limit | US-10 |

## 4. Simulation and claims

| Term | Meaning | See |
|------|---------|-----|
| Crash library | Versioned historical drawdown paths (`crash-lib-v1`) | [10 §5](10-simulation-engines.md#5-crash-replay-library) |
| Monte Carlo (bootstrap) | Resampled quarterly returns, seeded (`csp-mc-bootstrap-q-v1`) | [10 §6](10-simulation-engines.md#6-monte-carlo-csp-mc-bootstrap-q-v1) |
| Backtest (BS proxy) | Historical replay with Black–Scholes-estimated premiums; labelled `unconfirmed` | [10 §7](10-simulation-engines.md#7-backtest-csp-backtest-bsproxy-v1) |
| Seed, input hash, model version | Reproducibility triple stored with each result | [10 §3](10-simulation-engines.md#3-reproducibility-contract) |
| p05 / p50 / p95 | 5th / 50th / 95th percentile outcomes; never called "expected" | – |
| Claim label | `illustrative_meeting` · `sourced_sim` · `unconfirmed` | [12 §3](12-compliance-copy.md#3-return-claims-policy) |
| Cite or refuse | Missing source ⇒ refuse the number instead of guessing | FP-6 |

## 5. Learning and game

| Term | Meaning | See |
|------|---------|-----|
| ECD | Evidence-Centered Design: competency → evidence → task | [03 §2](03-serious-game-design.md#2-design-stance-ecd-in-one-picture) |
| Competency | vocabulary, arithmetic, risk, cash discipline, strike selection, management | [03 §3](03-serious-game-design.md#3-competency-model) |
| Evidence rule `C-*` | Observable behaviour that counts toward mastery, e.g. `C-ARITH-1` | [03 §4](03-serious-game-design.md#4-evidence-model-how-mastery-is-measured) |
| Misconception `MC-nn` | Known wrong belief with a remediation card | [03 §8](03-serious-game-design.md#8-misconception-taxonomy--remediation) |
| Process scoring | Points for process quality; outcome (P&L) weight is 0 | FP-8 |
| Anti-casino | No streaks, jackpots, timers or confetti for trades | [03 §7](03-serious-game-design.md#7-behavioural-design-patterns-used) |

## 6. Platform

| Term | Meaning | See |
|------|---------|-----|
| RLS | Row Level Security; policies use `app.user_id` set per transaction | [09 §8](09-database.md#8-roles-and-row-level-security) |
| `security_invoker` | View option so RLS applies to the caller, not the view owner | EC-DB-011 |
| Temporal PK | `PRIMARY KEY (…, valid WITHOUT OVERLAPS)` (PG18) | EC-DB-002 |
| Virtual generated column | Computed on read (PG18 default); cannot use enums or be indexed | EC-DB-009 |
| `uuidv7()` | Time-ordered UUID (PG18 built-in) | EC-DB-001 |
| JCS | JSON Canonicalization Scheme (RFC 8785), input to `payload_hash` | [09 §7](09-database.md#7-audit-trail-append-only-and-hash-chained) |
| Hash chain | Each audit row's `chain_hash` covers the previous one | ADR-013 |
| SKIP LOCKED | Queue pattern: workers claim different jobs without blocking | [07 §11](07-architecture.md#11-worker-and-job-queue) |
| Unit of work (UoW) | One transaction: set user, do work, write audit | [07 §7.3](07-architecture.md#73-unit-of-work-rls-context-and-audit-in-one-transaction) |
| Port / adapter | Interface the use case needs / its implementation (`Clock`, `Llm`, …) | [07 §7.2](07-architecture.md#72-ports-typescript) |
| Capability | Server-computed flag (`onboarded`, `phase_cash_put`, …) that drives guards | [04 §5](04-ux-ia-flows.md#5-gates-and-locks) |
| Screen registry | `packages/contracts/screens.ts`: one entry per SCR drives routes, guards, banners, tests | [05 §1](05-screens-wireframes.md#1-screen-registry) |
| Problem details | RFC 9457 error body with a stable `code` | [07 §8.1](07-architecture.md#81-error-catalogue-single-source-packagescontractserrorsts) |
| Idempotency-Key | Client UUID making a mutation safe to retry | [07 §8.2](07-architecture.md#82-idempotency-and-concurrency) |
| SSE | Server-Sent Events; agent token stream | [08 §9](08-frontend-architecture.md#9-agent-drawer-streaming) |
| RAG, HNSW, RRF | Retrieval-augmented generation; vector index; reciprocal-rank fusion of vector + text search | [11 §6](11-agent-llm.md#6-retrieval-rag) |
| Citation guard | Strips numbers not backed by a tool result or cited chunk | [11 §7](11-agent-llm.md#7-citation-guard) |
| FakeLlm | Scripted `LlmPort` adapter for deterministic tests | [11 §5](11-agent-llm.md#5-runtime-topology-and-model-settings) |
| Trace gate | CI step: every ID in the docs has an executed test, and vice versa | [14 §6](14-test-strategy.md#6-traceability-gate-ci) |

## 7. Time, place, tax

| Term | Meaning |
|------|---------|
| HKT / ET | Hong Kong Time (UTC+8, no DST) / US Eastern (DST). Every "as of" shows both |
| HK year of assessment (YoA) | 1 April – 31 March, e.g. `2026/27` |
| IRO s.14 | Hong Kong profits-tax charging section; may apply if the activity is a trade |
| Badges of trade | Factors used to judge whether activity is a trade; the app records notes, never a verdict |

## 8. ID prefixes

| Prefix | Meaning | Defined in |
|--------|---------|-----------|
| `FP-n` | First-principle truth | [00 §3](00-why-first-principles.md#3-first-principles-truths-that-must-hold) |
| `AUTH-1`, `US-n` | User stories | [01 §5](01-product-spec.md#5-user-stories) |
| `G-n`, `OPEN-n` | Gaps in Needs, open questions | [01 §9–10](01-product-spec.md#9-gap-analysis-of-needs) |
| `SCR-nnn` | Screens | [05 §1](05-screens-wireframes.md#1-screen-registry) |
| `R-XXX` | Draft rules | [02 §8](02-investment-domain.md#8-draft-checklist-rules) |
| `C-XXX-n`, `MC-nn` | Evidence rules, misconceptions | [03](03-serious-game-design.md) |
| `EC-XX-nnn` | Edge cases | [13](13-edge-cases.md) |
| `CP-XXX` | Copy lint rules | [12 §5](12-compliance-copy.md#5-copy-lint-rules-ci) |
| `J1`–`J6` | E2E journeys | [14 §5](14-test-strategy.md#5-end-to-end-playwright) |
| `F0`, `En`, `En-Tn` | Walking skeleton, epics, tasks | [15](15-implementation-plan.md) |
| `ADR-nnn` | Architecture decisions | [17](17-adr.md) |
| `V-nn` | Verification log entries | [18 §3](18-references.md#3-verification-log) |

---

## Cross-references

[README](README.md) · [00 WHY](00-why-first-principles.md) · [13 Edge cases](13-edge-cases.md) · [16 Traceability](16-traceability.md)
