# 10 · Simulation Engines (Investment Expert + Developer lens)

> Source: [`Needs/8 Backtest & MC`](../Needs/8%20Backtest%20%26%20Monte%20Carlo/backtest-mc.md). Code: `packages/sim` (pure, seeded).
> Verified core: [`appendix/domain-spike/src/mc.ts`](appendix/domain-spike/src/mc.ts) (determinism, `fill_cash` p05 worse, 10k×20 in 10–25 ms).

---

## 1. WHY (simulation lens)

The simulators exist so the user **feels the left tail and path dependency before** a draft (FP-3). They produce
**educational distributions, not forecasts**. The risk is that a simulator becomes a yield-promise machine. So every output carries a
`claim_label`, a `model_version` and an input hash, and it is displayed as a range, never as one number ([12 §3](12-compliance-copy.md#3-return-claims-policy)).

## 2. Engines at a glance

| Engine | Question it answers | Runs | `model_version` | Claim label | Screen |
|--------|--------------------|------|-----------------|-------------|--------|
| Payoff | What do I make or lose at expiry for each price? | inline, pure | `payoff-v1` | illustrative (deterministic) | SCR-020, 004 |
| Crash replay | What would a named crash have done to one lot? | inline worker thread | `crash-lib-v1` | sourced_sim (data cited) | SCR-021, 010 |
| Monte Carlo | What range of outcomes do bootstrapped paths give? | inline worker thread | `csp-mc-bootstrap-q-v1` | sourced_sim | SCR-022, 032 |
| Backtest | How would the envelope rules have behaved historically? | PG job (worker) | `csp-backtest-bsproxy-v1` | **unconfirmed** (premium proxy) | SCR-023 |

## 3. Reproducibility contract

```
 params (Zod-validated, defaults applied)  ─┐
 model_version                              ├─► JCS canonical JSON ─► sha256 ─► input_hash "sha256:<64 hex>"
 dataset_version (e.g. qqq-q-2010-2026-v1) ─┘
                                                     │
          stress_result UNIQUE (user, kind, model_version, input_hash)   ← same inputs ⇒ same row (dedup)
                                                     │
          same seed + same input_hash ⇒ byte-identical summary            ← property test EC-SM-001
```

- The RNG is `mulberry32(seed)` (32-bit, fast, reproducible across JS engines). `Math.random` is banned in `packages/sim` (lint).
- Datasets are versioned files in `packages/sim/data/` with a manifest: `source_url`, `retrieved_at`, `sha256`, licence note. The build fails if a file's hash does not match its manifest (EC-SM-008).
- Results are immutable (DB trigger). A re-run with new inputs creates a new result, and the memo link (`memo_stress`) points to the chosen one until a draft exists ([09 §4](09-database.md#4-core-tables-by-module)).

## 4. Payoff engine

For a short put `(K, p, q)` or covered call `(B, Kc, c, q)`, evaluate P&L at expiry on a grid that **always includes 0, break-even, the strike and spot**:

```
 short put:     pnl(S) = p·M·q − max(K − S, 0)·M·q
 covered call:  pnl(S) = c·M·q + (min(S, Kc) − B)·M·q
```

It is identical to the invariants at the anchor points (`pnl(0) = −worst_case`, `pnl(break_even) = 0`), which is a property test (EC-IV-001).

## 5. Crash replay library

```
 scenario file (packages/sim/data/crash/<id>.json)
 { id: "dotcom_2000", version: 1, underlying: "NDX-proxy→QQQ", start: "2000-03-10",
   weekly_close: [...], iv_path: [...], source_url: "...", sha256: "..." }

 replay(scenario, envelope, sizing):
   t0: spot S0 ─► strike K = pick in envelope (mid-band OTM) ─► premium = BS(S0, K, T, r, iv0)
   weekly: mark short put to market (BS with iv_t) ─► record MTM, drawdown
   expiry: S_T < K ? assigned (basis K − p) : expire
   if wheel flag and assigned: sell call ≥ basis each period until called away or path end
   compare: T-bill only · buy-and-hold QQQ · CSP (one lot | fill_cash)
```

| Scenario | Narrative use (Needs) | Notes |
|----------|-----------------------|-------|
| `dotcom_2000` | Concentration warning (a cash-maxed book is wrecked) | QQQ started 1999-03; the path uses Nasdaq-100 index levels scaled to QQQ (disclosed) |
| `gfc_2008` | Severe drawdown discipline | – |
| `covid_2020` | Fast crash and rebound | Short, violent; tests the week-2 plan |
| `custom_upload` | Advanced | P1 (upload validation is its own attack surface) |

Acceptance (Needs §6): `dotcom_2000` with `fill_cash` shows a **worse** loss path than one lot (EC-SM-006).

## 6. Monte Carlo (`csp-mc-bootstrap-q-v1`)

```
 for path in 1..paths:                                  (default 10,000; cap 20,000)
   cash = start_cash; S = spot
   for q in 1..quarters:                                (default 20; cap 40)
     K  = S × (1 − otm)                                 (otm from envelope midpoint or user value in band)
     n  = fill_cash ? floor(cash / (K·100)) : min(max_contracts, floor(cash / (K·100)))
     prem = BS_put(S, K, T=0.25, rf, iv) × 100 × n
     R  = bootstrap draw from quarterly returns (seeded)
     S1 = S × (1 + R)
     cash += prem + (reserve_earns_rf ? cash : cash − K·100·n) × rf × 0.25 − max(K − S1, 0) × 100 × n
     track wealth → per-path max drawdown; target_funded(q) = cash ≥ K·100 (next lot)
     S = S1
 summary: cagr p05/p50/p95 · p_below_start · median_max_dd · target_funded_rate · wealth p05/p50
```

| Parameter | Default | Validation | Why |
|-----------|---------|------------|-----|
| `envelope_id` | `beginner_v1` | enum; Mentor only if eligible or override | US-2 |
| `paths` | 10,000 | 100 ≤ x ≤ 20,000 | DoS cap (EC-SM-003) |
| `quarters` | 20 | 1 ≤ x ≤ 40 | Horizon cap |
| `seed` | 20260828 | int32 | Reproducible |
| `otm_pct` | band midpoint | must be inside the envelope band | No out-of-band sims by default |
| `max_contracts` | 1 | 1 ≤ x ≤ 10 | Willingness |
| `sizing_mode` / `fill_cash` | `willingness` / false | `fill_cash=true` ⇒ typed confirm + audit `fill_cash_enabled` | Dangerous mode |
| `rf_rate` | latest cited `rate_snapshot` | required; null ⇒ 422 `RATE_NOT_CITED` "cite a rate first" | Cite-or-refuse (EC-MD-006) |
| `reserve_earns_rf` | true | boolean, shown in the UI | G15: stack assumption made explicit |
| `iv` | from dataset (delayed mids → implied) | 0.05 ≤ x ≤ 1.5 | Proxy disclosed |
| `wheel` | false (prototype semantics) | true ⇒ covered calls with the basis rule | Needs §6 |

Prototype semantics preserved: bootstrap window 2010-03-31 → 2026-08-27 (n = 66 quarters), flatten at expiry, no early assignment.
The early-assignment model and tax drag are **UNCONFIRMED** and are not modelled (the UI says so).

## 7. Backtest (`csp-backtest-bsproxy-v1`)

- Walk the historical timeline quarterly (or monthly for Mentor ~3-month rolls). At each decision date, apply the **same rule registry** as real drafts (envelope, hurdle, lots), then log `sell | skip(reason)`, assignment and optional covered call.
- Premium comes from the Black-Scholes proxy with dataset IV. This is disclosed as `unconfirmed` until OPEN-2 (options history vendor) is resolved.
- Metrics: CAGR, volatility, max drawdown, assignment frequency, % of quarters with premium < rf, terminal wealth quantiles, skip-reason histogram.
- Runs as a `job` (`kind='backtest'`). Progress is written to `job.payload.progress`, and the UI polls `GET /jobs/:id` every 1 s with back-off.

## 8. Execution model

```
 POST /sim/mc ─► Zod caps ─► input_hash ─► existing result? ─yes─► 200 (cached, immutable)
                                   │ no
                                   ▼
                    Bun Worker thread (packages/sim)  ── 2 s hard timeout ─► 503 SIM_TIMEOUT
                                   │ summary only (never 10k paths over the wire)
                                   ▼
                    INSERT stress_result ─► 201 { result_id, summary, claim_label, disclaimer }
```

## 9. Numerical correctness tests

| Test | Property | EC |
|------|----------|----|
| Determinism | same seed + inputs ⇒ identical summary; different seed ⇒ different | EC-SM-001 |
| Put-call parity | `C − P = S − K·e^{−rT}` within 1e-6 | EC-SM-002 |
| Bounds | `0 ≤ P ≤ K·e^{−rT}`; `σ→0` ⇒ intrinsic | EC-SM-002 |
| Monotonicity | premium decreases as OTM increases; increases with T and σ | EC-SM-002 |
| Degenerate paths | zero-variance returns ⇒ MC equals the deterministic ledger | EC-SM-004 |
| Sizing | `fill_cash` p05 ≤ willingness p05 on the same seed (spike: verified) | EC-SM-006 |
| Caps | paths 20,001 ⇒ 400; runtime > 2 s ⇒ 503, no partial row | EC-SM-003 |
| Performance | 10k × 20 < 250 ms on CI (spike: 10–25 ms locally) | EC-SM-003 |
| Claim hygiene | every summary response has `claim_label` + `disclaimer`; the UI renders `ClaimLabel` | EC-CP-002 |

## 10. API contract (normative, extends Needs §10)

```json
POST /api/v1/sim/mc
{ "envelope_id": "beginner_v1", "paths": 10000, "quarters": 20, "seed": 20260828,
  "max_contracts": 1, "sizing_mode": "willingness", "fill_cash": false,
  "otm_pct": "0.085", "rf_rate_id": "0192…", "reserve_earns_rf": true, "wheel": false }

201
{ "result_id": "0192…", "model_version": "csp-mc-bootstrap-q-v1", "dataset_version": "qqq-q-2010-2026-v1",
  "input_hash": "sha256:…", "claim_label": "sourced_sim",
  "summary": { "cagr_p05": "-0.0290", "cagr_p50": "0.0610", "cagr_p95": "0.1180",
               "p_below_start": "0.14", "median_max_dd": "-0.187", "target_funded_rate": "0.91" },
  "disclaimer": "Educational simulation. Not a forecast. Meeting ~7-8% illustrative only, not a floor. Annualising one quiet quarter is misleading." }
```

Numbers above are placeholders. Decimals are strings on the wire (EC-MN-004). `rf_rate` is referenced by id so the citation travels with the result.

---

## Cross-references

[00 FP-3](00-why-first-principles.md#3-first-principles-truths-that-must-hold) · [02 Sizing](02-investment-domain.md#6-sizing-lots-and-willingness) ·
[03 Crash mode](03-serious-game-design.md#5-task-model-modes-and-loops) · [05 SCR-020…023](05-screens-wireframes.md#4-simulate) · [12 Claims](12-compliance-copy.md#3-return-claims-policy) ·
[13 EC-SM](13-edge-cases.md#ec-sm-simulation)
