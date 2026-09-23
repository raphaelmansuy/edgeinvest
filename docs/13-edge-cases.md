# 13 · Edge-case catalogue (all lenses)

> Every edge case has an **ID**, a **mitigation**, the **layer** that enforces it and a **test**. The CI traceability gate
> ([14 §6](14-test-strategy.md#6-traceability-gate-ci)) fails the build if any ID below has no test whose title starts with `[EC-…]`.
> ✓ = already demonstrated by the spikes (31/31 SQL checks, 31/31 domain tests; [18 §3](18-references.md#3-verification-log)).

---

## 1. WHY this catalogue exists

Selling puts is "boring until it isn't". Losses come from the corners: a wrong-side ticket, a stale quote, a second lot during a
drawdown, a quarter annualised into a promise. The catalogue makes every corner a named, tested object.

```
                          ┌──────────── defence in depth ────────────┐
 input ─► Zod (contracts) ─► domain rule / pure fn ─► use case ─► DB constraint / RLS / trigger ─► UI state + copy
          "shape"             "meaning"                "flow"      "last line"                     "honesty"
 Each edge case names the FIRST layer that stops it; later layers are defence in depth, not the plan.
```

Legend for **Layer**: `Z` Zod · `D` domain (`packages/domain`) · `S` sim (`packages/sim`) · `U` use case · `DB` Postgres · `API` HTTP layer · `FE` front end · `AG` agent guard · `OPS` runtime.
Legend for **Test**: `U` bun unit · `P` fast-check property · `I` integration on real Postgres · `C` API contract · `E` Playwright e2e · `L` nightly LLM eval. Paths are relative to the repo root.

## 2. Map of families

```
 Numbers ─────── EC-MN money, EC-IV invariants, EC-TM time
 Market ──────── EC-MD market data, EC-CS cash & settlement
 Strategy ────── EC-EN envelopes, EC-PK packets, EC-DR drafts, EC-WH wheel, EC-SM simulation
 People ──────── EC-LN learning & game, EC-UX user experience, EC-CP compliance & copy
 Platform ────── EC-AG agent, EC-SEC security, EC-DB database, EC-LG ledger, EC-OPS operations
```

---

## EC-MN Money and numbers

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-MN-001 | Float drift (`0.1+0.2`) in premiums, reserves, basis | Scaled `bigint` (4 dp) in domain; `NUMERIC` in DB; strict parse regex `^(-)?(\d{1,14})(?:\.(\d{1,4}))?$` | D | U `packages/domain/money.test.ts` ✓ |
| EC-MN-002 | Input `1e3`, `1,000`, `.5`, `12.345678`, locale commas | Rejected, never coerced; message names the format | Z, D | U money ✓ · E inputs form |
| EC-MN-003 | Limit price off the 0.01 tick | `R-TICK` → `OFF_TICK` | D | U rules ✓ |
| EC-MN-004 | JSON numbers lose precision on the wire | Decimals are **strings** in every contract; Zod `z.string().regex()` | Z | C contracts snapshot |

## EC-IV Invariants

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-IV-001 | Five numbers inconsistent (`worst ≠ reserve − max`) | Single `invariants()` function; UI never recomputes | D | P `invariants.prop.test.ts` ✓ |
| EC-IV-002 | Impossible inputs: premium ≥ strike, q = 0, negative strike | Typed error, no partial result | D | U ✓ |
| EC-IV-003 | Break-even ≤ 0 or ≥ K | Property `0 < BE < K` | D | P ✓ |
| EC-IV-004 | Covered call below basis shown as "profit" | `locked_loss ⇔ Kc < B`; max profit may be negative and is shown in loss colour | D, FE | U ✓ · E SCR-037 |

## EC-TM Time and calendars

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-TM-001 | DTE computed on HKT date (off by one) | `daysToExpiry` uses `America/New_York` calendar | D | U with clock at HKT 07:00 ✓ |
| EC-TM-002 | US DST switch changes HKT market hours | Staleness uses ET session; tests on 2026-03-08 and 2026-11-01 | D | U `time.test.ts` |
| EC-TM-003 | Expiry on an exchange holiday (Good Friday) | Expiry comes from the captured quote, never generated | D, U | U fixture `2027-03-26` |
| EC-TM-004 | User confused about which "as of" | Every as-of shows HKT **and** ET | FE | E screens 030/031/032/036/102 |

## EC-MD Market data

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-MD-001 | Empty chain | Refusal text "No quote, refusing to invent one"; no candidate | D, FE | U ✓ · E SCR-031 |
| EC-MD-002 | Stale quote (market closed, old capture) | `R-STALE` → `CHAIN_STALE`; closed-market banner | D | U with fake clock |
| EC-MD-003 | Crossed quote (bid > ask) | DB CHECK; Zod refine | Z, DB | I ✓ |
| EC-MD-004 | Wide or one-sided spread | Default limit = bid; spread > 10% of mid ⇒ candidate reject `WIDE_SPREAD` | D | U scoring |
| EC-MD-005 | Future-dated snapshot; non-QQQ ticker | DB CHECK `as_of ≤ created + 5 min`; `R-ALLOW` | DB, D | I ✓ · U |
| EC-MD-006 | Uncited or constant risk-free rate | `rate_snapshot.source_url ~ '^https://'`; sims require `rf_rate_id` (422 `RATE_NOT_CITED`) | DB, API | I ✓ · C `/sim/mc` |
| EC-MD-007 | Non-standard deliverable after a corporate action | Quote flag ⇒ `NON_STANDARD_DELIVERABLE` refusal | D | U |
| EC-MD-008 | Expiry already passed or DTE 0 in pasted quote | Zod refine `expiry > as_of`; `R-DTE` blocks anyway | Z, D | U · C |

## EC-CS Cash and settlement

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-CS-001 | Settled USD short of reserve (incl. reserves of open puts) | `R-CASH` → `CASH_NOT_SECURED` | D | U ✓ |
| EC-CS-002 | Negative HKD (FX loan) while "cash covered" in USD | `R-FX` → `FX_LOAN` + account halt `fx_loan` | D, U | U ✓ · I halt |
| EC-CS-003 | Exactly-funded reserve; NLV vs settled cash | Boundary passes; only **settled** USD counts | D | U ✓ |
| EC-CS-004 | Snapshot older than 24 h used for a draft | `R-ACCT` → `STALE_ACCOUNT_SNAPSHOT`; prompt to re-capture (SCR-102) | D | U · E SCR-102 |

## EC-EN Envelopes

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-EN-001 | Strike outside the envelope band (incl. the 12–16% gap) | `R-OTM` (puts) → `OTM_OUTSIDE_ENVELOPE` | D | U ✓ (9.9% in Mentor; 12.22% in Beginner) |
| EC-EN-002 | Mentor chosen before mastery | Capability `mentor_selectable`; override needs typed phrase + audit `envelope_override_before_mastery` | U, API | C · E SCR-071 |
| EC-EN-003 | Envelope changed after a memo was created | Memo stores `envelope_id`; temporal history answers "which envelope at t" | DB | I |
| EC-EN-004 | Code envelope params drift from DB row | Boot check `params_sha256`; API refuses to start | OPS | I boot test |
| EC-EN-005 | Envelope change while a put is open | Allowed; applies to **next** opening only; open leg keeps its memo's envelope | U | U · I |

## EC-PK Packets and memos

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-PK-001 | Draft without crash + MC on a put packet | `R-PACKET` → `PACKET_INCOMPLETE` (crash optional for call packets) | D | U ✓ |
| EC-PK-002 | Ranking a rejected candidate | Rejected ⇒ unranked (DDL CHECK) with reasons shown | DB, D | I · U |
| EC-PK-003 | Stress result from different inputs attached to memo | Attach checks `input_hash` equals memo inputs; else 409 `STRESS_MISMATCH` | U | C |
| EC-PK-004 | "Sell" decision without a written pre-commitment | CHECK `coalesce(length(plan),0) ≥ 10` | DB, Z | I ✓ |
| EC-PK-005 | History pagination skips/duplicates on new inserts | Keyset cursor on `(created_at, memo_id)` (uuidv7) | API | C |
| EC-PK-006 | Skip reason `other` with empty note (NULL slips CHECK) | `coalesce` CHECK | DB | I ✓ |

## EC-DR Drafts and the human gate

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-DR-001 | BUY to open / SELL to close (wrong side) | `R-SIDE`; DB CHECK makes it unrepresentable | D, DB | U ✓ · I ✓ |
| EC-DR-002 | Market order | `R-LMT` → `NOT_LIMIT` | D | U ✓ |
| EC-DR-003 | Blocked draft with no reason, or reason without block | CHECK `blocked ⇔ reasons ≠ {}` | DB | I |
| EC-DR-004 | Options level too low (put needs Level 3) | `R-LEVEL` → `LEVEL_GAP` + halt `level_gap` | D | U ✓ |
| EC-DR-005 | Playbook step skipped (e.g. no preview) | Steps are ordered; human gate needs all steps ticked; Paper needs the SIM bar step | U | E SCR-040 |
| EC-DR-006 | Double-click on "I placed it in IBKR" | Idempotency-Key; single `draft_submitted_by_user` audit | API | C · E |
| EC-DR-007 | Fill price differs from the draft limit, or partial fill | Fill form records actual price and qty; basis uses **actual** fill; partial ⇒ q must be whole contracts | D, U | U ✓ basis · C `/fill` |

## EC-WH Wheel lifecycle

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-WH-001 | Two open legs in one cycle | Partial unique index | DB | I |
| EC-WH-002 | Expiry outcome assumed (pin risk, after-hours exercise) | User confirms from the broker notice; no automatic transition | U | E SCR-103 |
| EC-WH-003 | Second lot (incl. two concurrent sessions) | `R-LOTS`; `wheel_cycle_guard` trigger with row lock | D, DB | U ✓ · I race ✓ |
| EC-WH-004 | Covered call below basis | `R-BASIS` blocks until the locked-loss veto is typed on SCR-045 | D | U ✓ · E |
| EC-WH-005 | Illegal transition (shares_held → short_put_open) | Domain `transition()`; DB `allowed_transition` trigger | D, DB | U ✓ · I ✓ |
| EC-WH-006 | New cycle while halted | `R-HALT` + guard trigger; clear re-evaluates (409 `HALT_CONDITION_PERSISTS`) | D, DB | I ✓ · C |
| EC-WH-007 | Early assignment (American style) | `short_put_open → shares_held` legal any day; SCR-103 "I was assigned early" | D | U · E |
| EC-WH-008 | Early call exercise before ex-dividend | `R-EXDIV` warning + M5 lesson | D | U |
| EC-WH-009 | Shares ≠ 100·q (odd lot) or broker basis ≠ decision basis | `share_lot.qty % 100 = 0`; UI labels "decision basis for the call rule" next to the broker's figure | DB, FE | I · E SCR-035 |
| EC-WH-010 | Call strike below spot (ITM) | `R-ITM` warning | D | U |

## EC-SM Simulation

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-SM-001 | Non-reproducible MC | Seeded PRNG; `input_hash`; same seed ⇒ identical bytes | S | P ✓ |
| EC-SM-002 | Black-Scholes proxy nonsense (parity, bounds) | Parity within 1e-6; bounds; monotonicity | S | P |
| EC-SM-003 | DoS: huge paths / quarters; slow run | Caps (paths ≤ 20,000; quarters ≤ 40); 2 s worker timeout ⇒ 503, no partial row | Z, S | C · U |
| EC-SM-004 | Zero-variance or degenerate paths | MC equals deterministic ledger | S | P |
| EC-SM-005 | Unknown crash scenario id | 404 `UNKNOWN_SCENARIO`; library versioned `crash-lib-v1` | S, API | C |
| EC-SM-006 | `fill_cash` sizing looks attractive | Available only in simulators; p05 worse than one lot on same seed | S, FE | U ✓ |
| EC-SM-007 | Backtest read as a forecast | Claim `unconfirmed` + `sim.not_forecast`; BS-proxy disclosed | FE | E SCR-023 |
| EC-SM-008 | Dataset silently changed | Manifest sha256 checked at build | OPS | U build check |

## EC-LN Learning and game

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-LN-001 | Guessing / answer-farming | Randomised variants; evidence needs 2 distinct items; attempt limits | D | U mastery |
| EC-LN-002 | Vocabulary learned by pattern, not meaning | C-VOC-2 transfer item in a different context | content | U content schema |
| EC-LN-003 | Pass threshold changed after grading | Pass flag computed with the threshold stored at grading | DB | I ✓ |
| EC-LN-004 | Mastery marked complete early | CHECK on `mastery_progress` | DB | I ✓ |
| EC-LN-005 | Time pressure pushes rash choices | No timers in crash/committee modes | FE | E (no countdown element) |
| EC-LN-006 | Content with unknown MC/C tags | Zod content schema; build fails | OPS | U content build |
| EC-LN-007 | Paper lab consumes the real lot | Paper lab state only in `game_attempt.decisions`; never writes `wheel_cycle` | U | I (row counts unchanged) |

## EC-UX User experience

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-UX-001 | Score shown before the five numbers | DOM order: numbers before rank | FE | E |
| EC-UX-002 | Skip is harder to reach than Prepare | Skip first in tab order, same size | FE | E |
| EC-UX-003 | Accessibility violations | axe on every route: 0 serious/critical | FE | E |
| EC-UX-004 | Route tree drifts from the screen registry | Unit test: 46 routes equal | FE | U |
| EC-UX-005 | Stale capability after a change (e.g. ack) | Invalidate `qk.capabilities` + `router.invalidate()` | FE | E |
| EC-UX-006 | Retry after a network drop duplicates a write | Same Idempotency-Key reused by the mutation | FE, API | E (offline toggle) |

## EC-CP Compliance and copy

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-CP-001 | Missing or dismissible banner where required | Registry-driven `ComplianceBanner` | FE | E all routes |
| EC-CP-002 | "Sell" CTA, guarantees, unlabeled returns | Copy lint CP-CTA/CP-GUAR/CP-YIELD, static + rendered | FE, OPS | U lint · E |
| EC-CP-003 | Live mode without eligibility or re-ack | `R-MODE` → `LIVE_NOT_ELIGIBLE`; re-ack at each Live gate | D, U | C · E SCR-072 |
| EC-CP-004 | HK export read as tax advice | Header disclaimer; no characterisation column | U | C CSV header |
| EC-CP-005 | Copy version bump without re-ack | Capability `onboarded` checks current version | U | C · E |

## EC-AG Agent

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-AG-001 | Agent tries to submit / change status | No such tool; registry snapshot + name lint | AG | U registry |
| EC-AG-002 | Advice-seeking ("what should I sell?") | Refuse template + audit `agent_refuse_advice` | AG | U guard · L red team |
| EC-AG-003 | Invented quotes / uncited numbers | Chain tool fails closed; citation guard strips numbers | AG | U guard · L |
| EC-AG-004 | Agent contradicts the rule verdict | Rule status rendered outside agent text; contradiction detector flags "passes/ok" vs blocked | AG, FE | U · E |
| EC-AG-005 | Prompt injection in content or pasted text | Tool results wrapped as data; no status-changing tools | AG | L red team |
| EC-AG-006 | Malformed tool arguments / invalid JSON | Zod validation; one repair; then graceful stop | AG | U FakeLlm |
| EC-AG-007 | Guarantee or firm "we" in output | Output lint CP-GUAR / CP-VOICE | AG | U · L |
| EC-AG-008 | Ollama unreachable or model missing | `agent_available=false`; offline banner; app fully works | OPS, FE | E `AGENT_PROVIDER=off` |
| EC-AG-009 | Flooding the local GPU | 20 turns / 5 min; 1 in-flight turn per user | API | C |
| EC-AG-010 | Hints on graded items | Drill mode locked server-side by `game_attempt.graded` | U | C · E |
| EC-AG-011 | Drawer closed mid-stream | `AbortController`; server cancels Ollama request | FE, API | E |
| EC-AG-012 | Empty or mixed index during re-embed | New version embedded fully before switch | U | I |

## EC-SEC Security

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-SEC-001 | Credential stuffing, weak hashes | argon2id (DB CHECK prefix); 5 attempts / 15 min | API, DB | C · I |
| EC-SEC-002 | Cross-user access (IDOR) | RLS on every table, fail closed; foreign ids ⇒ 404 | DB | I ✓ |
| EC-SEC-003 | Session theft / fixation | `__Host-sid`, HttpOnly, SameSite=Strict; rotate on sign-in; hash at rest | API | C |
| EC-SEC-004 | CSRF | SameSite + `X-CSRF` header + Origin check | API | C |
| EC-SEC-005 | XSS / clickjacking | Strict CSP, `frame-ancestors 'none'`; sign-out-all | API, FE | C headers · E |
| EC-SEC-006 | Auth bootstrap under RLS | Only two SECURITY DEFINER functions, pinned `search_path` | DB | I ✓ |
| EC-SEC-007 | Audit tampering | Append-only + hash chain + verify endpoint | DB | I ✓ |
| EC-SEC-008 | Any path to order submission | `/orders/*` 501; no broker port; bundle grep | API, OPS | E probe · U |
| EC-SEC-009 | Stored XSS through notes / memo text | Rendered as text; markdown sanitised; no `dangerouslySetInnerHTML` (Biome rule) | FE | U lint · E payload |

## EC-DB Database

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-DB-001 | Non-time-ordered keys | `uuidv7()` defaults | DB | I ✓ |
| EC-DB-002 | Overlapping envelope periods | Temporal PK `WITHOUT OVERLAPS` | DB | I ✓ |
| EC-DB-003 | UPDATE/DELETE on audit | Triggers + REVOKE | DB | I ✓ |
| EC-DB-004 | Domain edges drift from DB transitions | Drift test compares sets | D, DB | U ✓ |
| EC-DB-005 | Audit written outside the business transaction | Audit in the same UoW transaction | U | I (rollback leaves no audit) |
| EC-DB-006 | Broken chain unnoticed | `GET /audit/verify` window query | DB | I |
| EC-DB-007 | Stress results mutated / duplicated | Immutable; UNIQUE inputs | DB | I ✓ |
| EC-DB-008 | Transition audit without old/new values | `RETURNING old.*, new.*` | DB | I ✓ |
| EC-DB-009 | VIRTUAL column with enum / needing index | STORED for those | DB | I (DDL applies) ✓ |
| EC-DB-010 | NULL passes CHECK | `coalesce` in nullable CHECKs | DB | I ✓ |
| EC-DB-011 | Views bypass RLS | `security_invoker = true`; catalogue test on `reloptions` | DB | I ✓ leak demo |

## EC-LG Ledger

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-LG-001 | Two views disagree | One `ledger_entry` source, two derived views | DB | I ✓ |
| EC-LG-002 | Sign errors | CHECK sign by kind | DB | I ✓ |
| EC-LG-003 | Quarter vs HK year of assessment boundary (31 Mar / 1 Apr) | Generated columns; verified dates | DB | I ✓ |
| EC-LG-004 | Correction by editing history | Reversing entries only; `ledger_entry` append-only | DB | I |
| EC-LG-005 | Annualising a single quarter | `annualise()` returns `null` + `quarter.no_annualise` | D, FE | U · E SCR-046 |

## EC-OPS Operations

| ID | Edge case | Mitigation | Layer | Test |
|----|-----------|------------|-------|------|
| EC-OPS-001 | PG18 data dir mounted at the old path | Volume at `/var/lib/postgresql` | OPS | `docker compose config` check |
| EC-OPS-002 | Worker crash leaves jobs `running` | Reaper after 10 min | U | I |
| EC-OPS-003 | Ollama not reachable from containers (Linux) | `extra_hosts: host-gateway`; optional `linux-gpu` profile | OPS | smoke |
| EC-OPS-004 | Secrets in git | `.env` ignored; gitleaks in CI | OPS | CI |
| EC-OPS-005 | Data loss | `pg_dump` script + restore test | OPS | I restore |
| EC-OPS-006 | Edited applied migration | Checksum mismatch ⇒ migrator refuses | OPS | I |

---

## Cross-references

[02 Rule registry](02-investment-domain.md#8-draft-checklist-rules) · [07 Error catalogue](07-architecture.md#81-error-catalogue-single-source-packagescontractserrorsts) ·
[09 Constraint catalogue](09-database.md#9-constraint-catalogue--edge-cases) · [14 Test strategy](14-test-strategy.md) · [16 Traceability](16-traceability.md)
