# 03 · Serious Game Design (Serious Game Expert lens)

> Source: [`Needs/6 Learning`](../Needs/6%20Learning%20curriculum%20%26%20serious%20game/learning.md).
> Method: **Evidence-Centered Design** (ECD). We define what competence looks like, what observable behaviour
> counts as evidence and which tasks elicit it. Content is secondary to evidence (FP-7).

---

## 1. WHY (game lens)

Reading about crashes does not change behaviour under a crash. The game exists to let the user **rehearse** the two moments
that go wrong in real life: seeing the numbers **before** selling, and staying disciplined **after** a drawdown or assignment.
It must produce **evidence** strong enough to unlock Mentor and Live modes (FP-7, FP-8).

## 2. Design stance: ECD in one picture

```
 ┌───────────────────────┐     what we claim      ┌────────────────────────┐   how we observe   ┌─────────────────────┐
 │ COMPETENCY MODEL      │ ─────────────────────► │ EVIDENCE MODEL         │ ◄───────────────── │ TASK MODEL          │
 │ 6 competencies (§3)   │                        │ C-* rules (§4)         │                    │ quizzes, 5 modes    │
 │ vocabulary … mgmt     │ ◄───── mastery_progress│ competency_evidence    │ ─── emits ───────► │ seeded, hint-off    │
 └───────────────────────┘      (projection)      │ (append-only)          │                    │ when graded (§5)    │
                                                  └────────────────────────┘                    └─────────────────────┘
```

## 3. Competency model

| Competency | Can do (observable) | Typical misconceptions (see §8) |
|------------|---------------------|---------------------------------|
| `vocabulary` | Define share, put, call, strike, premium, expiry, assignment; translate a ticket into a sentence | MC-01 |
| `arithmetic` | Compute reserve, max profit, break-even, worst case from any ticket, to the cent | MC-02 |
| `risk` | Read p05/p50/p95 and max drawdown; reject guarantee language; explain early assignment | MC-03, MC-09, MC-10 |
| `cash_discipline` | Detect FX loans; keep settled USD ≥ reserve; one lot | MC-04, MC-08 |
| `strike_selection` | Place a strike in the right envelope band; apply the T-bill hurdle; reject out-of-band | MC-05 |
| `management` | Follow the pre-commitment plan; handle assignment without dumping; sell calls ≥ basis; pick the right lifecycle outcome | MC-06, MC-07 |

## 4. Evidence model: how mastery is measured

Every row is a deterministic rule in `packages/domain/mastery.ts`. It fires only on **graded** attempts (hints off, seeded parameters)
and writes one `competency_evidence` row (`rule_id`, `passed`, `source_ref`). A competency becomes `passed` when **all** its rules have ≥ 1 passing row.

| C-id | `rule_id` | Competency | Pass condition | Task / screen |
|------|-----------|------------|----------------|---------------|
| C-VOC-1 | `vocab.flash_6of7` | vocabulary | ≥ 6 of 7 flash cards correct in one graded run | SCR-002 |
| C-VOC-2 | `vocab.quiz_m1` | vocabulary | Quiz M1 ≥ 80% | SCR-006 |
| C-ARITH-1 | `arith.three_tickets` | arithmetic | 3 **distinct-seed** tickets, all four numbers exact to the cent | SCR-004 |
| C-ARITH-2 | `arith.quiz_m3` | arithmetic | Quiz M3 ≥ 80% | SCR-006 |
| C-RISK-1 | `risk.crash_debrief` | risk | Crash mode finished **and** debrief answered (p05 identified, plan followed or deviation explained) | SCR-010 |
| C-RISK-2 | `risk.quiz_m7` | risk | Quiz M7 ≥ 80% (includes "is 7–8% guaranteed?" → No) | SCR-006 |
| C-CASH-1 | `cash.fx_loan_item` | cash_discipline | FX-loan item answered correctly (HKD cash + USD put ⇒ loan) | SCR-006 (M2) |
| C-CASH-2 | `cash.paper_no_negative` | cash_discipline | Paper-lab cycle finished with no negative currency balance at any step | Paper lab |
| C-STRIKE-1 | `strike.band_quiz` | strike_selection | Envelope band items correct (Beginner 5–12 vs Mentor 16–30) | SCR-006 (M4) |
| C-STRIKE-2 | `strike.reject_out_of_band` | strike_selection | In a scenario, rejects the seeded out-of-band or below-hurdle candidate | SCR-009 |
| C-MGMT-1 | `mgmt.committee` | management | Committee memo decided (sell/skip/wait) with rationale and, if sell, a pre-commitment plan | SCR-011 |
| C-MGMT-2 | `mgmt.post_assign_cc_ge_basis` | management | After forced assignment, selects a call with strike ≥ basis (or an explicit, justified locked-loss accept) | SCR-012 |
| C-MGMT-3 | `mgmt.short_call_outcome` | management | Chooses the correct lifecycle outcome for a seeded expiry | SCR-012 → SCR-044 (paper) |

```
 mastery_all_pass  ⇔  all six competencies = passed
                   ∧  paper_wheel_completed_at IS NOT NULL
                      (paper-lab cycle closed after visiting shares_short_call, i.e. includes the SCR-012 path)
 DB: CHECK on mastery_progress.all_passed_at mirrors this (verified, EC-LN-003)
 Unlocks: Mentor envelope without override (SCR-071) · Live mode eligibility (SCR-072, still needs disclosure acks)
 No regression in MVP (assumption). A later failing evidence shows "review suggested", never re-locks.
```

**Anti-gaming (EC-LN-001…006):**
- Parameters are **seeded and randomised** (strike, premium, spot, DTE). Memorised answers do not transfer. The seed is stored on the attempt.
- Item pools: ≥ 3 variants per learning objective. The same variant never repeats inside a 24 h window.
- Graded attempts: hints are off, the agent drawer's **Drill** mode is disabled for that item (EC-AG-010), and answers are checked server-side.
- A remediation card for the detected misconception must be opened before retrying a failed quiz (no cooldown timer: friction, not punishment).
- Evidence is append-only (DB trigger), and `mastery_progress` is a projection rebuilt from it (`RebuildMastery` use case, idempotent).

## 5. Task model: modes and loops

### 5.1 The core loop (all modes)

```
   ┌────────┐   ┌──────────────┐   ┌──────────┐   ┌──────────────┐   ┌───────────┐   ┌──────────┐
   │ BRIEF  │──►│ PRE-COMMIT   │──►│ DECIDE   │──►│ REVEAL PATH  │──►│ DEBRIEF   │──►│ EVIDENCE │
   │ numbers│   │ "If −20% in  │   │ sell/skip│   │ seeded path  │   │ process   │   │ C-* rows │
   │ first  │   │  week 2, I…" │   │ /wait/…  │   │ week by week │   │ rubric §6 │   │          │
   └────────┘   └──────────────┘   └──────────┘   └──────┬───────┘   └───────────┘   └──────────┘
                                         ▲               │ checkpoint (e.g. −20%, near expiry)
                                         └───────────────┘ hold / buy back / roll / accept assignment / sell call
```

### 5.2 Modes

| Mode (`game_attempt.mode`) | Screen | Goal | Mechanic | Graded? | Evidence |
|----------------------------|--------|------|----------|---------|----------|
| `tutorial` | SCR-008 | Ticket mechanics, Bid = sell | Guided taps on a mock IBKR ticket; a wrong side is shown to be blocked | No | none |
| `scenario` | SCR-009 | Choose inside the envelope | 3–5 candidates (one out-of-band, one below hurdle); weekly path reveal | Yes | C-STRIKE-2 |
| `crash` | SCR-010 | Feel the tail | Named path (`dotcom_2000`, `gfc_2008`, `covid_2020`); forced −20% checkpoint in week 2 | Yes | C-RISK-1 |
| `committee` | SCR-011 | Monthly workflow | Build a mini-packet (numbers, crash, MC, skip option); decide with memo | Yes | C-MGMT-1 |
| `post_assign` | SCR-012 | Assignment without panic | Forced assignment; basis shown; pick a call ≥ basis; see outcomes | Yes | C-MGMT-2, C-MGMT-3 |
| `paper_lab` | SCR-009 → SCR-012 | One full wheel, fast | Same seed walks the put leg (forced assignment), then the call leg, to a closed cycle | Yes | C-CASH-2, `paper_wheel_completed_at` |

### 5.3 Paper lab (the practice ground)

The paper lab is **our** simulated book. It is not the IBKR paper account. It reuses the **same domain package**
(wheel state machine, invariants, rule registry, cost-basis rule) through the game engine, so the rules the user practises are byte-for-byte
the rules that gate real drafts (DRY). It does **not** write `wheel_cycle` or `ledger_entry`. Its state is the event list in
`game_attempt.decisions`, replayed by pure functions. So a practice lot can never consume the real `lots_max` (EC-LN-007).
A `SimClock` fast-forwards to expiry along the seeded path. This forces a full cycle with a **forced assignment** in minutes instead of 60–120 days.

```
 Paper lab = packages/domain (same rules)  +  seeded path  +  SimClock   ── state in game_attempt.decisions
            ─────────────────────────────────────────────────────────────────────────────────────────────
            put "fill" → [fast-forward] → assigned (forced) → basis → call ≥ basis → [ff] → called away → closed
                                                                                          └─► paper_wheel_completed_at
```

## 6. Scoring: process over outcome

**Resulting** means judging a decision by its outcome. It is the bias that makes this strategy dangerous: quiet quarters reward overselling.
So the score measures **process**. P&L is shown, never scored (FP-8).

| Rubric item (per graded attempt) | Weight | Evidence |
|----------------------------------|--------|----------|
| Five numbers stated correctly before deciding | 25 | exact cent match |
| Stayed inside the envelope (or skipped) | 20 | candidate chosen / skip |
| Applied the T-bill hurdle (skipped below-hurdle) | 15 | choice vs hurdle flag |
| Wrote a pre-commitment plan, then followed it at the checkpoint (or explained the deviation) | 25 | plan text + checkpoint action |
| Respected one lot / no FX loan | 15 | sizing + balance trace |
| **Outcome P&L** | **0** | shown for context only |

```
 ANTI-CASINO RULES (lint + design review; violations are bugs)          reference anti-pattern:
 ✗ no points, coins or streaks for premium collected                      Needs/…/snack-man.html
 ✗ no confetti / celebration on a sell or on profit                        (lives, score, speed-up =
 ✗ no leaderboards, no social comparison of returns                         variable-reward loop)
 ✗ no "you missed X% by skipping" messages
 ✗ no timers pressuring a decision (checkpoints wait for the user)
 ✓ celebrate process: "You skipped a below-hurdle trade. That is the job."
 ✓ neutral tone; restate capital at risk alongside any premium
```

Feedback template (verbatim style from Needs):

```
Correct. Selling one QQQ 90 put for 1.30 reserves USD 9,000 and
creates a maximum profit of USD 130. Break-even USD 88.70.
Below that, losses increase dollar-for-dollar with QQQ.
```

## 7. Behavioural design patterns used

| Pattern | Bias it counters | Implementation | Where |
|---------|------------------|----------------|-------|
| Implementation intention ("If X then I will Y") | Panic, disposition effect | `precommit_plan` required for `sell` (DB CHECK); shown back when spot < break-even | US-11, SCR-032/103 |
| Default effects | Overreach | Beginner envelope, Paper mode, 1 lot by default | [02 §5–6](02-investment-domain.md#5-strategy-envelopes) |
| Equal-weight Skip | Action bias | Skip is primary, first in focus order, logged without penalty | FP-4, US-7 |
| Friction on danger | Impulsivity | Typed confirmation for override, `fill_cash`, locked-loss accept | SCR-071/022/045 |
| Reference-class view | Anchoring on 7–8% | MC distribution (p05/p50/p95) next to any illustrative number | SCR-022/032 |
| Premortem | Overconfidence | Committee asks "what makes this trade go wrong?" before deciding | SCR-011 |
| Outcome-blind grading | Resulting | Rubric weight 0 on P&L (§6) | Game engine |
| Honest loss framing | Premium myopia | Reserve restated in every feedback line | Copy registry |

## 8. Misconception taxonomy → remediation

| ID | Misconception | Detected by | Remediation card | Re-test |
|----|---------------|-------------|------------------|---------|
| MC-01 | "Tap Ask to sell" / buying a put = selling | Tutorial/quiz wrong-side item | Bid = sell, Ask = buy; preview must say SELL | M1 + tutorial |
| MC-02 | Premium ≈ profit with no capital at risk | Arithmetic errors on reserve | The five numbers; reserve is idle cash | SCR-004 |
| MC-03 | "~7–8% is guaranteed / a floor" | M7 claim item | Illustrative vs sourced sim; MC fan | M7 |
| MC-04 | HKD cash covers a USD put | FX item | Three-layer OS: FX first; negative balance = loan | M2 |
| MC-05 | Further OTM is always safer and better | Scenario pick below hurdle | Safe-strike trap; T-bill hurdle | SCR-009 |
| MC-06 | Assignment = failure, sell the shares | Post-assign action | Wheel path; basis; call ≥ basis | SCR-012 |
| MC-07 | Any call is fine to exit | Call below basis chosen | Locked loss is a conscious choice | SCR-012 |
| MC-08 | Add lots to catch up | Sizing choice | Concentration; dotcom fill_cash replay | SCR-010 |
| MC-09 | A quiet quarter × 4 = annual return | Annualisation item | Block warning; path dependency | M7 |
| MC-10 | Assignment only happens at expiry | Early-assignment item | American style; ex-div calls | M5 |

## 9. Curriculum → task → evidence map

| Module | Screen | Tasks | Evidence |
|--------|--------|-------|----------|
| M0 WHY | SCR-001 | Reflection: state the purpose (not graded) | – |
| M1 Seven words | SCR-002, SCR-006 | Flash cards, translate ticket | C-VOC-1/2 |
| M2 Three-layer OS | SCR-003, SCR-006 | FX → treasury → overlay; FX-loan item | C-CASH-1 |
| M3 CSP arithmetic | SCR-004, SCR-006 | Three seeded tickets; payoff table | C-ARITH-1/2 |
| M4 Strike & T-bill | SCR-031 (lab), SCR-006 | Band items; hurdle comparison | C-STRIKE-1 |
| M5 Wheel / CC | SCR-005, SCR-012 | Assignment path; call ≥ basis; early assignment | C-MGMT-2 |
| M6 IBKR Mobile lab | SCR-040, SCR-043 | Step coach walk-through (paper) | – (practice) |
| M7 Stress literacy | SCR-010, 021, 022 | Read p05/p50; reject guarantees | C-RISK-1/2 |
| M8 HK tax awareness | SCR-051 | Know the uncertainty; export for adviser | – (awareness) |
| M9 Monthly committee | SCR-011, 032, 037 | Memo with skip option | C-MGMT-1 |

## 10. Content pipeline (for developers)

```
 packages/content/
   modules/M0..M9/*.md          ← prose, versioned by content_version (front-matter)
   items/*.ts                   ← quiz item generators: (seed) => { prompt, answer, tags: [MC-xx, C-xx] }
   scenarios/*.ts               ← { id, version, mode, pathGenerator(seed), checkpoints[], rubric }
   remediation/MC-xx.md
 All validated by Zod schemas at build time; unknown MC/C tags fail the build (EC-LN-006).
```

## 11. How we will know the game works

| Signal | Measure | Target |
|--------|---------|--------|
| Learning | First-attempt vs final-attempt score per misconception tag | Positive delta on every MC tag |
| Transfer | Real packets: share blocked by `WRONG_SIDE`/`FX_LOAN` after mastery | → 0 |
| Discipline | Committee + real skip rate when below hurdle | Skip ≥ 80% of below-hurdle cases |
| Engagement quality | Median graded attempts to pass | Informational (not maximised) |

---

## Cross-references

[00 FP-7/8](00-why-first-principles.md#3-first-principles-truths-that-must-hold) · [04 Journeys](04-ux-ia-flows.md#4-journeys) ·
[05 Learn & Game screens](05-screens-wireframes.md#3-learn) · [09 mastery tables](09-database.md#4-core-tables-by-module) ·
[10 Simulation paths](10-simulation-engines.md) · [13 EC-LN](13-edge-cases.md#ec-ln-learning-and-game) · [14 tests](14-test-strategy.md)
