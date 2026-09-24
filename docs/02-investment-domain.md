# 02 · Investment Domain (Investment Expert lens)

> Single source of truth for **formulas, states and rules**. Code lives in `packages/domain`
> (verified spike: [`appendix/domain-spike/src`](appendix/domain-spike/src/)). Screens, API, DB and agent
> **call** this package; nothing re-implements a formula (DRY).

---

## 1. WHY (domain lens)

A cash-secured put pays a small, frequent premium and carries a rare, large obligation
([00 §2](00-why-first-principles.md#2-first-principles-what-a-cash-secured-put-physically-is)).
The software has one domain job: make that asymmetry **computed, visible and bounded** before any ticket exists.

## 2. Invariants: the five numbers

Money is an integer count of 1/10,000 USD (`Usd4`, [§11](#11-money-and-precision)). `q` = contracts, multiplier `M = 100`.

```
SHORT PUT (strike K, premium p per share)            COVERED CALL (basis B, call strike Kc, premium c)
────────────────────────────────────────             ─────────────────────────────────────────────────
reserve     = K × M × q                              shares_covered = M × q
max_profit  = p × M × q                              credit_only    = c × M × q
break_even  = K − p                                  max_profit     = credit_only + (Kc − B) × M × q
worst_case  = reserve − max_profit   (S → 0)         locked_loss    = Kc < B
cost_basis  = K − p_fill   (on assignment)           worst_case     = B × M × q − credit_only  (S → 0)

Preconditions (refuse with a typed error, never "best effort"):
  q ∈ ℤ, q ≥ 1 · K > 0 · p > 0 · p < K · prices on the 0.01 tick
```

All figures are **gross of commissions**. The UI says "before fees", and fees are separate ledger entries ([§10](#10-candidate-generation-and-scoring)).

Property tests (fast-check, in the spike) that must stay green:

| Property | Statement | EC |
|----------|-----------|----|
| Identity | `worst_case == reserve − max_profit` for every valid input | EC-IV-001 |
| Linearity | `reserve(q) == q × reserve(1)` | EC-IV-002 |
| Break-even bound | `0 < break_even < K` | EC-IV-003 |
| Round trip | `parseUsd4(format(x)) == x` | EC-MN-002 |
| Call locked loss | `locked_loss ⇔ Kc < B`, and then `max_profit < credit_only` | EC-IV-004 |

## 3. Worked examples (these exact numbers are test fixtures)

```
Example A (M3 quiz / walkthrough) : SELL 1 QQQ 90 P @ 1.30
  reserve 9,000.00 · max profit 130.00 · break-even 88.70 · worst case 8,870.00

Example B (Mobile article, 28 Aug 2026, spot 721.11) : SELL 1 QQQ 650 P Nov-20-2026 @ 9.80 limit
  reserve 65,000.00 · max profit 980.00 · break-even 640.20 · worst case 64,020.00
  OTM = (721.11 − 650) / 721.11 = 9.86 %      → inside beginner_v1 (5–12 %), outside mentor (16–30 %)

  Filled at 9.62 (not 9.80) then assigned  → cost basis = 650 − 9.62 = 640.38   ← uses FILL (US-10)

Example C (after B): SELL 1 QQQ 700 C @ 8.00 with basis 640.38
  credit 800.00 · max profit 800 + (700 − 640.38) × 100 = 6,762.00 · worst case 64,038 − 800 = 63,238.00
  SELL 1 QQQ 620 C → locked_loss = true → blocked LOCKED_LOSS_UNSIGNED until audited accept

Example D (time zone): now = 2026-09-24 07:00 HKT = 2026-09-23 19:00 ET
  DTE to 2026-11-20 = 58 (ET calendar). Naive HKT date would give 57  → EC-TM-001
```

## 4. The wheel state machine

One **cycle** = one 100-share commitment per contract. It is the aggregate that serialises all state changes.

```
  (no cycle)
      │ RecordFill: put SELL-to-open filled (SCR-103)
      ▼
 ┌──────────────────┐
 │  short_put_open  │◄──┐ roll: BUY-close + SELL-open
 └──┬────────────┬──┘───┘ (net credit or debit logged)
    │            │
    │            └── expired · bought back ──────────────────┐
    │ assigned (any day, American style)                     │
    │ B = K − net put credit per share                       │
    ▼                                                        ▼
 ┌──────────────────┐                                  ┌──────────┐
 │   shares_held    │── shares sold manually ─────────►│  closed  │
 └──┬────────────▲──┘                                  └──────────┘
    │            │ call expired · bought back                ▲
    │ CC filled (Kc ≥ B, or audited locked-loss accept)      │
    ▼            │                                           │
 ┌───────────────┴──┐                                        │
 │shares_short_call │◄──┐ roll                               │
 └────────┬─────────┘───┘                                    │
          └── called away (incl. early, ex-dividend) ────────┘

 phase (derived):  cash-put    ⇐ short_put_open | closed
                   shares-held ⇐ shares_held | shares_short_call
```

Transition table (domain `wheel.ts` = primary guard; DB `allowed_transition` + trigger = defence in depth, EC-DB-004):

| From → To | Trigger (use case) | Ledger entries (signed USD) | Audit actions | Screen |
|-----------|--------------------|-----------------------------|---------------|--------|
| ∅ → short_put_open | `RecordFill` (put, open) | `put_premium` +p·M·q | `fill_recorded`, `phase_changed` | SCR-103 |
| short_put_open → closed | `RecordExpiry` / `RecordBuyBack` | none / `buy_to_close` −x·M·q | `phase_changed` | SCR-103 |
| short_put_open → short_put_open | `RecordRoll` (two fills, one tx) | `buy_to_close` −, `put_premium` + | `fill_recorded` ×2 | SCR-103 |
| short_put_open → shares_held | `ConfirmAssignment` | `assignment_purchase` −K·M·q | `assignment_confirmed`, `phase_changed` | SCR-034 |
| shares_held → shares_short_call | `RecordFill` (call, open) | `call_premium` +c·M·q | `fill_recorded`, `phase_changed` | SCR-044 |
| shares_short_call → shares_held | `RecordExpiry` / `RecordBuyBack` | none / `buy_to_close` − | `phase_changed` | SCR-044 |
| shares_short_call → shares_short_call | `RecordRoll` | `buy_to_close` −, `call_premium` + | `fill_recorded` ×2 | SCR-044 |
| shares_short_call → closed | `ConfirmCalledAway` | `called_away_sale` +Kc·M·q | `phase_changed` | SCR-044 |
| shares_held → closed | `RecordShareSale` | `share_sale` +x·M·q | `phase_changed` | SCR-044 |

**Cost-basis rule (decision basis, not tax basis).**
`B = K_assigned − (Σ put credits − Σ put buy-to-close debits in this cycle) / (M·q)`.
Without rolls this reduces to `K − p_fill`, which is the Needs formula and Example B. The broker's displayed basis may differ.
The UI labels ours "decision basis for the call rule" (EC-WH-009).

## 5. Strategy envelopes

Config-as-code in `packages/domain/envelope.ts`. It is mirrored in the `envelope` table for foreign-key integrity, and at boot the service asserts
that the `params_sha256` of the code matches the DB row (EC-EN-004).

```
 OTM % of spot  0%    5%        12%      16%              30%
               ├─────┼─────────┼────────┼────────────────┼──────►
 beginner_v1         ███████████                                   60–120 DTE · default · no mastery needed
 mentor_cyrille_v1                       ██████████████████         60–120 DTE · needs mastery_all_pass
                     (gap 12–16 %: in neither band ⇒ OTM_OUTSIDE_ENVELOPE; intentional)
```

| Param | beginner_v1 | mentor_cyrille_v1 | Source |
|-------|-------------|-------------------|--------|
| OTM band (put, inclusive) | 5–12% | 16–30% | Walkthrough / meeting |
| DTE band (ET calendar) | 60–120 | 60–120 (~3 months, roll) | Mobile article / meeting |
| `lots_max` | 1 | 1 | Locked 2026-09-19 |
| Order type | LMT only | LMT only | Playbook |
| Requires mastery | no | yes (override is audited) | PRD US-2 |
| Honest expectation | Higher premium, higher assignment frequency | Lower premium, lower assignment frequency (**verify on live chains**) | backtest-mc §4 |

Selection history uses the PG18 temporal key (`envelope_selection`, [09 §5](09-database.md#5-temporal-envelope-history-pg18)).
A memo **stores** the `envelope_id` in force when it was created, so historical packets stay reproducible (EC-EN-003).

## 6. Sizing, lots and willingness

```
 willingness (DEFAULT)      lots = 1  (max_contracts = 1)            ← teaching rule, concentration guard
 fill_cash  (DANGEROUS)     lots = floor(settled_usd / (K × 100))    ← simulation only, explicit confirm,
                                                                        audited fill_cash_enabled, red chrome
```

- `wheel_state.lots_max` defaults to 1. Raising it needs mastery, a typed confirmation and `mode_changed`-style audit. P1 only; the MVP UI does not offer it.
- `fill_cash` exists **only in the simulators** (SCR-022/023) to show why it is dangerous. The dotcom_2000 crash with fill_cash must show a worse p05 than one lot (acceptance test, EC-SM-006).
- `target_funded` is **computed**: `leftover_usd ≥ reserve_for_next_lot`, where `leftover_usd = settled_usd − Σ reserve(open short puts)`. It is not stored (G4) and is not a return promise.
- Willingness (SCR-035): "I am willing to own 100 QQQ at K through a further large drawdown". Answering "no" raises the halt `willingness_declined`.

## 7. The T-bill hurdle and the stack

```
 For a candidate put (K, p, DTE) and T-bill rate r (annual, as_of, https source):

   premium_yield_ann = (p / K) × 365 / DTE          ← "for comparison with T-bill only, not a return"
   hurdle            = r
   below_hurdle      = premium_yield_ann < r        ← reject reason 'premium_below_tbill' (skip code #1)

 Display for Example B (650 P @ 9.80, 58 DTE, r = 3.78 %), never one blended number (G15):
   ┌─────────────────────────────┬───────────────────────────────────────────────┐
   │ Premium leg   1.51 % / 58 d │ 9.49 % annualised for comparison              │
   │ T-bill leg    3.78 % p.a.   │ only if your reserved cash actually earns it  │
   │ Illustrative meeting ~7–8 % │ not a guarantee · not a floor                 │
   └─────────────────────────────┴───────────────────────────────────────────────┘
```

Why it is a hurdle: the premium is compensation for accepting equity-crash risk on `K × 100`. If the premium yields less than risk-free cash
over the same days, the walkthrough's "safe-strike trap" applies: you are underpaid for the tail.
This is a **heuristic** shown to the user. It is not an optimiser.

## 8. Draft checklist rules

Rule registry (Open/Closed): each rule is `{ id, severity, appliesTo(ctx), check(ctx) }`, and the evaluator never changes when a rule is added.
`blocked ⇔ any rule with severity=block fails` (DB CHECK mirrors this: `blocked ⇔ block_reasons ≠ {}`).

| Rule | Spike id | Applies to | Fails when | Reason code | Severity | Raises halt | EC |
|------|----------|------------|-----------|-------------|----------|-------------|----|
| `R-SIDE` | side_matches_intent | all | open≠SELL or close≠BUY | `WRONG_SIDE` | block | – | EC-DR-001 |
| `R-LMT` | limit_only | all | order type ≠ LMT | `NOT_LIMIT` | block | – | EC-DR-002 |
| `R-TICK` | *(new)* | all | limit not on the 0.01 tick | `OFF_TICK` | block | – | EC-MN-003 |
| `R-CHAIN` | chain_present | opening | no bid or no ask for the contract | `EMPTY_CHAIN` | block | – | EC-MD-001 |
| `R-STALE` | *(new)* | opening | quote `as_of` older than the staleness window | `CHAIN_STALE` | block | – | EC-MD-002 |
| `R-PHASE` | phase_matches_instrument | opening | put while shares-held / call while cash-put | `PHASE_MISMATCH` | block | – | EC-WH-005 |
| `R-LOTS` | lots_available | opening put | `lots_open + q > lots_max` | `SECOND_LOT_WITHOUT_CASH` | block | `second_lot_without_cash` | EC-WH-003 |
| `R-OTM` | otm_in_envelope | opening **put** | OTM outside the band | `OTM_OUTSIDE_ENVELOPE` | block | – | EC-EN-001 |
| `R-DTE` | dte_in_envelope | opening | DTE (ET) outside the band | `DTE_OUTSIDE_ENVELOPE` | block | – | EC-TM-001 |
| `R-CASH` | cash_secured | opening put | `settled_usd − Σ open reserves < reserve` | `CASH_NOT_SECURED` | block | – | EC-CS-001 |
| `R-ACCT` | *(new)* | opening | account snapshot older than 24 h | `STALE_ACCOUNT_SNAPSHOT` | block | – | EC-CS-004 |
| `R-FX` | no_fx_loan | opening | any currency balance < 0 | `FX_LOAN` | block | `fx_loan` | EC-CS-002 |
| `R-LEVEL` | options_level | opening | put needs Level ≥ 3, call needs ≥ 1 | `LEVEL_GAP` | block | `level_gap` | EC-DR-004 |
| `R-PACKET` | packet_complete | opening **put** | crash or MC missing on the memo (call packets: crash optional, per Needs SCR-037) | `PACKET_INCOMPLETE` | block | – | EC-PK-001 |
| `R-BASIS` | call_strike_ge_basis | opening call | `Kc < B` and no audited accept | `LOCKED_LOSS_UNSIGNED` | block | – | EC-WH-004 |
| `R-HALT` | *(new)* | all | `wheel_state.halt_reason` set | `HALT_ACTIVE` | block | – | EC-WH-006 |
| `R-MODE` | *(new)* | live mode | no mastery, or a disclosure ack missing | `LIVE_NOT_ELIGIBLE` | block | – | EC-CP-003 |
| `R-ALLOW` | *(new)* | all | underlying ∉ allowlist {QQQ} | `NOT_ALLOWLISTED` | block | – | EC-MD-005 |
| `R-EXDIV` | *(new)* | opening call | ex-dividend date before expiry | `EXDIV_ASSIGNMENT_RISK` | warn | – | EC-WH-008 |
| `R-ITM` | *(new)* | opening call | `Kc < spot` | `CALL_ITM` | warn | – | EC-WH-010 |

Changes from the spike, tracked as E3/E6 tasks: `R-OTM` and `R-PACKET` narrow to puts (after assignment, spot and basis make the put band meaningless for calls).
`R-CASH` subtracts reserves already held by open short puts. `severity` is added.
Checklist JSON stored on `draft_preview.checklist` = `[{ id, pass, severity, reason? }]` in registry order.

## 9. Market realities the code must respect

| Reality | Consequence in code | EC |
|---------|---------------------|----|
| American-style: assignment can happen **any day**, not only at expiry | `short_put_open → shares_held` is legal at any time; SCR-103 offers "I was assigned early" | EC-WH-007 |
| Expiries and DTE are defined on the **US/Eastern** calendar; the user is in HKT (UTC+8, no DST) and the US switches DST | `daysToExpiry` uses `America/New_York`; tests at HKT 07:00 and at DST switch dates | EC-TM-001/002 |
| US market hours in HKT: 21:30–04:00 (US summer) / 22:30–05:00 (US winter) | Staleness window = 15 min during regular trading hours, else "since last close". A closed-market banner shows | EC-MD-002 |
| NYSE holidays; expiry on a holiday moves earlier (e.g. Good Friday) | Expiry dates come from the quote the user captured, not generated; the holiday calendar is only for staleness | EC-TM-003 |
| QQQ options: penny tick, multiplier 100, physical delivery | `R-TICK`; quantity in contracts; shares = 100·q | EC-MN-003 |
| Adjusted / non-standard deliverables after corporate actions | Quote rows flagged non-standard are refused (`NON_STANDARD_DELIVERABLE`) | EC-MD-007 |
| Quarterly dividends: calls with extrinsic value < dividend can be exercised early before ex-dividend | `R-EXDIV` warning + education in M5 | EC-WH-008 |
| After-hours exercise decisions and pin risk near the strike at expiry | Lifecycle does not assume the outcome; the user confirms from the broker notice | EC-WH-002 |
| US T+1 settlement for shares; option premium settles T+1 | Cash check uses **settled** USD, not NLV | EC-CS-003 |
| Bid/ask can be wide or one-sided off-hours | Default limit = bid (conservative for a seller); a spread above 10% of mid is a candidate reject reason | EC-MD-004 |
| Meeting rates (3.13%, 3.68%, 3.61%, 3.78%) are point-in-time | Never shipped as constants; the rate needs `as_of` + https source | EC-MD-006 |

## 10. Candidate generation and scoring

```
 option_quote rows (snapshot)  ──►  filter put_call = P, underlying ∈ allowlist
          │
          ├─ compute otm, dte(ET), invariants(limit = bid)          (domain, pure)
          ├─ reject reasons: OTM_OUTSIDE_ENVELOPE · DTE_OUTSIDE_ENVELOPE · NO_BID · WIDE_SPREAD
          │                  · PREMIUM_BELOW_TBILL · CASH_NOT_SECURED · CHAIN_STALE
          ▼
 score (only if no reject) = (premium_yield_ann − r) − 0.5 × (ask − bid) / mid
 rank  = order by score desc   (DB CHECK: rejected ⇒ rank IS NULL)
 UI    = five numbers first, then score & rank, rejected rows greyed with reasons (never hidden)
```

The score is a **tie-breaker inside the envelope**, not advice. That is why it renders after the invariants (US-1) and uses neutral language ("ranked by excess premium over T-bill, spread-penalised").

## 11. Money and precision

| Decision | Why | Where |
|----------|-----|-------|
| `Usd4` = integer 1/10,000 USD in TS, `NUMERIC(18,4)` in PG | Floats cannot represent 0.01. Four decimals leave room for per-share premium math | `money.ts`, DDL |
| Parse with a strict regex `^(-)?(\d{1,14})(?:\.(\d{1,4}))?$` | Reject `1e3`, `1,000`, `.5`, locale commas | EC-MN-001 |
| Display: 2 decimals for USD amounts, 2 for per-share prices, `%` with 2 decimals | Matches broker screens | [06](06-ui-design-system.md#5-component-inventory) |
| Floats are allowed only in simulation (MC paths); results are rounded at the boundary | Simulation is statistical, not accounting | [10](10-simulation-engines.md) |
| JSON money on the wire is a **string** `"9000.0000"` | No JS number precision loss | `packages/contracts` |

---

## Cross-references

[00 FP-1/2/9](00-why-first-principles.md#3-first-principles-truths-that-must-hold) · [09 Database](09-database.md) ·
[10 Simulation](10-simulation-engines.md) · [11 Agent tools](11-agent-llm.md#4-tool-catalogue) · [13 Edge cases](13-edge-cases.md) ·
[16 Traceability](16-traceability.md) · Needs: [IB playbook](../Needs/5%20IB%20playbook%20%28Mobile%20Pro%29/ib-playbook.md), [Backtest & MC](../Needs/8%20Backtest%20%26%20Monte%20Carlo/backtest-mc.md)
