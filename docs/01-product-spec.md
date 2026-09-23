# 01 · Product Specification (Product Owner lens)

> Source: [`Needs/1 PRD/PRD.md`](../Needs/1%20PRD%20%28deanpeters%20structure%29/PRD.md) v0.3. This document
> keeps its decisions, makes the stories testable on our stack and closes the gaps listed in [§9](#9-gap-analysis-of-needs).

---

## 1. WHY (product lens)

People go from a verbal CSP story to a live IBKR ticket without being able to state the obligation
([00 §1](00-why-first-principles.md#1-why-the-five-whys)). The product is a **spine**:
**learn → simulate → decide → draft → you submit → journal**. It is gated by demonstrated competence and never acts on the market.

**Epic hypothesis (from the PRD):** sequencing education → serious game → crash/MC → human-gated draft coaching
raises paper-cycle completion and reduces unsafe tickets (unreserved cash, wrong side, Level gap).
Measured 30–60 days after MVP ([§6](#6-success-metrics-and-instrumentation)).

## 2. Users & jobs

| Persona | Context | Primary jobs | MVP? |
|---------|---------|--------------|------|
| **Disciplined DIY Raphael** (primary) | HK tax resident, **personal** book, IBKR Mobile, ~100k USD teaching size | State the five numbers; stress-test; monthly/quarterly packet; draft and submit himself; HK tax journal | Yes |
| Mentor Cyrille (source) | Supplies the envelope (16–30% OTM, ~3 m, roll) and IB norms | Parameters only; not a user | Content only |
| Educator Eve (secondary) | Teaches learners | Quizzes, mastery view, paper reports | P1 (future) |

| JTBD type | Job |
|-----------|-----|
| Functional | Complete a paper wheel cycle; rank CSP candidates inside the envelope; run crash + MC; write a decision memo; prepare a draft for human submission |
| Emotional | Feel competent at the IBKR Preview screen; skip without shame |
| Social | Publish education without implying advice or speaking as firm capital ("we") |

## 3. Outcomes we want to see

```
 Behaviour today                         Behaviour we want (observable)
 ──────────────────────────────────────  ──────────────────────────────────────────────
 taps Ask (BUY) instead of Bid (SELL)  → draft blocked by R-SIDE, user re-drafts
 HKD cash, USD put → silent USD loan    → R-FX halts before the draft exists
 reads ~7–8% as an annual floor         → quiz answer "No, illustrative"; no yield chip
 freezes or dumps shares on a dip       → pre-commitment plan written before selling
 adds a 2nd lot "to catch up"           → SCR-045 halt second_lot_without_cash
 never records what happened            → fill recorded, ledger + audit chain complete
```

## 4. Solution overview

### 4.1 Story map (Jeff Patton backbone → MVP walking slice)

```
BACKBONE   Onboard      Learn          Practise        Simulate       Decide           Execute            Journal
─────────  ───────────  ─────────────  ──────────────  ─────────────  ───────────────  ─────────────────  ──────────────
MVP (P0)   sign in      WHY            tutorial        payoff         inputs (SCR-102) put playbook       audit log
           disclosures  seven words    scenario        crash library  snapshot         draft coach        quarterly ledger
           first run    three-layer    crash mode      Monte Carlo    candidates       human gate         HK tax CSV
                        arithmetic     committee                      packet + Skip    record fill        lessons
                        wheel/CC       post-assign                    assignment       short-put life
                        quizzes                                       call packet      call playbook
                                                                                       short-call life
                                                                                       halt
─────────  ───────────  ─────────────  ──────────────  ─────────────  ───────────────  ─────────────────  ──────────────
P1         OAuth IB     spaced review  educator mode   backtest+      broker read-sync deep link (OPEN-5) adviser pack
                                                       vendor data    (OPEN-1)         draft API (OPEN-1)
```

### 4.2 Spine with gates

```
 [SCR-100 Sign in] → [SCR-101 First run: WHY + jurisdiction + disclosure acks]
        │
        ▼
 LEARN SCR-001..006 ──quizzes ≥80%──► GAME SCR-007..012 ──6 competencies + paper wheel──► mastery_all_pass
        │                                                                                    │ unlocks
        ▼                                                                                    ▼
 SIMULATE SCR-020..023 (always open)                                   Mentor envelope · Live mode toggle
        │ attach crash + MC
        ▼
 DECIDE SCR-102 inputs → SCR-030 snapshot → SCR-031 candidates → SCR-032 packet
        │        [ Skip ▼ ]  [ Wait ]  [ Prepare draft ]   ← equal weight; Prepare needs FP-1..3 rules green
        ▼
 EXECUTE SCR-040 playbook → SCR-041 draft coach → SCR-042 human gate → (user submits in IBKR)
        │                                                        → SCR-103 record fill / lifecycle
        ▼                                                                  │ assigned?
 JOURNAL SCR-050 audit · SCR-046 ledger · SCR-051 HK CSV                   ▼
                                                 SCR-034 basis → SCR-035 willingness → SCR-036/037/038 call
                                                 → SCR-043 call playbook → SCR-044 short-call life → called away → cash-put
```

## 5. User stories

Format: story, **AC in Given/When/Then**, primary screens, and the edge cases each AC must survive.
`US-1`…`US-8` refine the Needs stories. `AUTH-1` and `US-9`…`US-12` are new ([§9](#9-gap-analysis-of-needs)).

### AUTH-1: Sign in and session
As a user I want a private account so that my book, audit trail and ledger are mine alone.
- **G** a registered email, **W** a correct password is submitted, **T** a `__Host-` session cookie is set (HttpOnly, Secure, SameSite=Strict), `session_started` is audited and I land on `SCR-101` if first run, else my last area.
- **G** 5 failed attempts in 15 min for the same email+IP, **W** another attempt, **T** 429 `RATE_LIMITED` with a retry-after.
- **G** any authenticated query, **T** Postgres RLS returns only my rows (fail-closed without session).
- Screens: SCR-100, SCR-101 · Edge: EC-SEC-001…008

### US-1: State the five numbers
As a beginner I want every ticket-like view to show **Reserve · Max profit · Break-even · Worst case (→0) · Bid×Ask** above any score, so I cannot proceed on vibes.
- **G** a put ticket (SCR-004/020/031/032/040/041), **W** any of the five numbers is missing or invalid, or the chain is empty, **T** **Prepare draft** is disabled and the empty-chain state says "No quote, refusing to invent one".
- **G** valid inputs, **T** values equal `packages/domain` formulas exactly (integer 1/10,000 USD), and the score is rendered **after** the invariant block in DOM order.
- **G** a limit price that is not on the penny tick (e.g. 1.325), **T** the input is rejected with "Limit must be in whole cents".
- Edge: EC-MN-001…004, EC-IV-001…004, EC-MD-001

### US-2: Beginner by default, Mentor after mastery
- **G** a new user, **W** SCR-000/071 loads, **T** envelope = `beginner_v1`; Mentor control shows "Locked until mastery" with a link to SCR-007.
- **G** `mastery_all_pass`, **W** Mentor is selected and confirmed, **T** `envelope_selection` closes the old period and opens a new one, and `envelope_changed` is audited.
- **G** no mastery, **W** override is confirmed through the two-step modal, **T** `envelope_override_before_mastery` is audited and the chrome shows "Mentor (override)".
- **G** any yield display, **T** premium leg and T-bill leg are shown separately, with no blended one-number chip and the ~7–8% "illustrative, not a floor" copy.
- Edge: EC-EN-001…005, EC-CP-002

### US-3: Crash + Monte Carlo before any draft
- **G** a memo without both crash and MC attached, **T** Prepare draft is disabled and names the missing kinds; **W** the API is called anyway, **T** the draft is stored with `status=blocked`, reason `PACKET_INCOMPLETE`, and `draft_blocked` is audited.
- **G** results attached, **T** `model_version`, seed, input hash and claim label are visible; "Past paths ≠ future" is shown; quarterly annualisation shows the block warning.
- **G** a memo that already has a draft, **W** the user re-runs MC, **T** the new result is stored but the memo link is frozen (409 `MEMO_FROZEN`).
- Edge: EC-SM-001…008, EC-PK-001…003

### US-4: IBKR Mobile playbook (put + call twin)
- **G** SCR-040, **T** the steps match the Mobile article language, the Paper bar reminder shows, and Level 3 is required for a put and Level 1 for a covered call.
- **G** SCR-043 in shares-held, **T** the preview coach requires "SELL call", and strike ≥ basis unless `locked_loss_accepted` is audited.
- **G** any CTA in the app, **T** labels come from the copy registry; the lint fails the build on a «Sell» CTA ([12 §5](12-compliance-copy.md#5-copy-lint-rules-ci)).
- Edge: EC-DR-001…006, EC-WH-004

### US-5: Agent reviews drafts, never submits
- **G** any agent session, **W** tools are listed, **T** no submit-like tool exists; `POST /api/v1/orders/*` returns 501 `NOT_IMPLEMENTED_SUBMIT` and audits `live_submit_attempt_blocked`.
- **G** a draft that fails any `R-*` rule, **T** `status=blocked` with the reasons from **code**; the agent's text may explain but cannot change status.
- **G** phase = cash-put, **T** the agent says "no share lot yet; the basis rule does not apply". **G** shares-held, **T** the basis rule is ON.
- **G** Ollama is unreachable, **T** see US-12.
- Edge: EC-AG-001…012

### US-6: HK tax journal (educational)
- **G** ledger entries, **W** Export CSV on SCR-051, **T** the file has a header disclaimer "not tax advice", grouping by HK year of assessment (1 Apr–31 Mar) **and** calendar quarter, and USD amounts; no auto filing; `hk_export` is audited with the row count.
- Edge: EC-LG-001…005, EC-CP-004

### US-7: Skip is first-class
- **G** SCR-032/037, **T** Skip has the same size and weight as Prepare draft and comes first in focus order.
- **W** Skip with a reason code, **T** a `memo_skip` row plus `skip_recorded` audit; code `other` requires a note of ≥ 3 characters (DB CHECK, NULL-safe).
- Edge: EC-PK-005, EC-PK-006

### US-8: Assignment writes basis before any call
- **G** an open short put, **W** the user confirms assignment on SCR-034, **T** in **one transaction**: leg closed `assigned`, `share_lot` created with `cost_basis = strike − fill premium`, cycle → `shares_held`, `assignment_confirmed` and `phase_changed` audited. Put flows then redirect to SCR-039.
- **G** call strike < basis, **W** Prepare draft, **T** blocked `LOCKED_LOSS_UNSIGNED` until SCR-045 locked-loss acceptance is audited.
- **G** called away on SCR-044, **T** lot closed, cycle `closed`, phase `cash-put`, `lots_open` decremented.
- **G** `lots_open ≥ lots_max`, **W** a new put draft, **T** halt `second_lot_without_cash` (SCR-045).
- Edge: EC-WH-001…010

### US-9: Market and account inputs, cite or refuse (new)
As Raphael I want to enter the quotes, T-bill rate and balances I see in IBKR, with their time, so candidates use real numbers and never invented ones.
- **G** SCR-102, **W** I save a chain snapshot, **T** each quote row needs strike, expiry, bid ≤ ask and `as_of`; crossed or future-dated quotes are rejected (DB CHECK).
- **G** a snapshot older than the staleness window (15 min in US market hours, else from the last close), **W** candidates are scored, **T** 409 `CHAIN_STALE` with "Refresh quotes".
- **G** a T-bill rate, **T** `source_url` (https) and `as_of` date are required; the UI shows "as of …, source …".
- Edge: EC-MD-001…008, EC-CS-001…004

### US-10: Record the fill and manage the short put (new)
As Raphael I want to record what IBKR actually filled so basis and ledger are true.
- **G** SCR-042 completed ("I submitted in IBKR"), **W** I record fill price and time on SCR-103, **T** `option_leg.open_price` = fill (may differ from limit), the invariants are recomputed with the fill, a `put_premium` ledger credit is written, and `fill_recorded` is audited.
- **G** an open short put, **W** I choose expired / bought back / rolled / assigned, **T** the matching transition runs; illegal transitions return 409 `ILLEGAL_TRANSITION`.
- **G** the draft was never filled, **W** I mark "not filled", **T** the draft goes to `discarded` and no cycle is created.
- Edge: EC-WH-001…003, EC-WH-007, EC-DR-007

### US-11: Pre-commitment plan (new)
As a disciplined investor I want to write my plan for a −20% move in week two **before** deciding to sell.
- **G** a packet, **W** the decision is `sell`, **T** `precommit_plan` of ≥ 10 characters is required (DB CHECK) and shown back on SCR-103 when the underlying is below break-even.
- Edge: EC-PK-004

### US-12: Safe when the agent is offline (new)
- **G** Ollama is down or times out (> 30 s), **T** the drawer shows "Agent offline. All safety checks still run", every gate behaves identically, and the packet critique block shows "not available" instead of blocking.
- Edge: EC-AG-008, EC-OPS-003

## 6. Success metrics and instrumentation

| Metric | Definition (computable from data) | Source | Target |
|--------|-----------------------------------|--------|--------|
| **Paper mastery completion** (primary) | users with `all_passed_at` within 30 d of first M1 attempt ÷ users who started M1 | `mastery_progress`, `quiz_attempt` | ≥ 70% (assumption) |
| Time to five numbers | median time from first SCR-004 view to first all-correct ticket | `competency_evidence` rule `C-ARITH-1` | Baseline in MVP |
| Packet stress coverage | memos with a draft ÷ memos with a draft **and** crash+MC | `v_memo_packet` | 100% (enforced) |
| Gate rejection mix | share of `draft_blocked` by reason | `audit_event` | Observe; no target |
| Healthy skip rate | `skip_recorded` ÷ decided memos | `audit_event` | Observe (skip is good) |
| **Guardrail**: autonomous sends | count of any order sent by the app | by construction | **0** |
| **Guardrail**: disclosure coverage | Execute/Agent views with a current ack ÷ views | `disclosure_ack` | 100% |
| **Guardrail**: "felt advised" | refuse-advice events reviewed ÷ raised | `agent_refuse_advice` | 100% reviewed |

## 7. Scope: in, out, later

| In (MVP P0) | Out (never, or separate product) | Later (P1+) |
|-------------|----------------------------------|-------------|
| Curriculum M0–M9, quizzes, 5 game modes | Autonomous live order sending | Broker read-only sync (OPEN-1) |
| Payoff, crash, MC (inline), backtest (queued, BS proxy) | Multi-client order desk / intermediary SaaS | Draft creation through an IBKR API (OPEN-1) |
| Manual quotes/rates/balances with citations | Margin, naked shorts, non-allowlisted underlyings | Mobile Preview deep link (OPEN-5) |
| Decide packet with Skip, call packet, assignment | Personalised advice / suitability engine | Options history vendor (OPEN-2) |
| Execute playbooks, human gate, fill recording, lifecycles, halt | Tax filing / IRD submission | Educator Eve dashboard |
| Agent Ask/Ticket/Packet/Drill (local Ollama) with deterministic gates | Casino gamification, points for premium | Spaced-retrieval reviews |
| Audit chain, ledger, HK CSV, disclosure acks | "We" voice for firm capital | Multi-underlying allowlist |

## 8. Release slices

| Slice | Contents | Exit criterion |
|-------|----------|----------------|
| **MVP-α** (F0–E4) | Shell, auth, learn, invariants, envelope, inputs, packet + Skip, crash/MC | A user can build a complete packet with skip or stress, end to end in Playwright |
| **MVP-β** (E5–E7) | Game + mastery, share phase, execute playbooks, fills, lifecycles, halt, ledger | A full paper wheel (put → assigned → call → called away) passes e2e |
| **MVP-γ** (E8–E9) | Agent, HK export, audit verify, hardening | Red-team suite green, trace gate green, a11y AA |

See [15](15-implementation-plan.md) for the task-level plan.

## 9. Gap analysis of Needs

Found while turning Needs into a buildable spec. Each item has a resolution and an owner document.

| # | Gap or inconsistency in Needs | Impact if ignored | Resolution | Where |
|---|-------------------------------|-------------------|------------|-------|
| G1 | No step records the **actual fill**. Basis would use the draft limit. | Wrong cost basis, so the basis rule and the tax ledger are wrong | US-10, SCR-103, `option_leg.open_price` = fill | [02 §4](02-investment-domain.md#4-the-wheel-state-machine) |
| G2 | Short-**put** lifecycle (expire/close/roll/assign) has no screen; only calls have one (SCR-044) | State machine cannot be driven from the UI | SCR-103 (twin of SCR-044) | [05](05-screens-wireframes.md) |
| G3 | MVP has no **live chain source** (Mode B is P1, OPEN-2 covers history only) | SCR-031 cannot work, or would invent quotes | SCR-102 manual capture + staleness + citations | US-9 |
| G4 | `packet_complete`, `target_funded`, `reserved_usd`, `leftover_usd`, `WheelState.cost_basis` are **stored** duplicates | Drift between stored flag and reality | Derived views / computed in domain | [09 §3](09-database.md#3-derive-dont-store) |
| G5 | `QuarterlyLeg` and `TaxJournalRow` duplicate the same cash flows | Two ledgers disagree | One append-only `ledger_entry`; both are views | [09 §6](09-database.md#6-ledger-one-source-two-views) |
| G6 | `StressResult UNIQUE(memo_id, kind)` forbids re-runs and couples results to memos | Cannot re-run, or silently overwrites | Immutable results + replaceable `memo_stress` link, frozen once a draft exists | [09 §4](09-database.md#4-core-tables-by-module) |
| G7 | Drafts only model SELL-to-open; "close early / roll" needs BUY-to-close | Wrong-side check misfires on closes | `open_close` column + CHECK (open⇒SELL, close⇒BUY) | `R-SIDE` |
| G8 | AUTH-1 referenced in E0 but never defined; no sign-in screen | E0 cannot be accepted | AUTH-1, SCR-100, SCR-101 | §5 |
| G9 | UX claims **44** screens; the catalog enumerates **42** unique IDs | Test coverage counts wrong | 42 + 4 new = **46**, registry-driven | [05 §1](05-screens-wireframes.md#1-screen-registry) |
| G10 | Mobile checklist's "written action if −20% in week two" is not in the data model | Pre-commitment evaporates | US-11 `precommit_plan` (DB CHECK) | [03 §7](03-serious-game-design.md#7-behavioural-design-patterns-used) |
| G11 | DTE timezone unspecified (HKT user, ET expiries) | Off-by-one DTE at HK morning ⇒ wrong envelope check | DTE on the US/Eastern calendar (verified test) | EC-TM-001 |
| G12 | Early assignment and ex-dividend risk only mentioned for education | Surprise assignment breaks the state machine | Lifecycle accepts "assigned" at any time; ex-div warning on calls | [02 §9](02-investment-domain.md#9-market-realities-the-code-must-respect) |
| G13 | Stack assumed Next.js + Redis/BullMQ | Conflicts with the chosen stack | Vite SPA + Bun/Hono + PG queue (measured) | [17 ADR-001..004](17-adr.md) |
| G14 | "Disclosure impressions" undefined (view? scroll? click?) | Unenforceable gate | Explicit ack per `copy_version` (`disclosure_ack`) | [12 §4](12-compliance-copy.md#4-disclosures-and-acknowledgement) |
| G15 | "Premium + T-bill stack" assumes the reserve earns the T-bill rate | Double counting in a cash account where reserved cash may not earn it | Show legs separately; the T-bill leg is labelled "only if your reserve earns it" | [02 §7](02-investment-domain.md#7-the-t-bill-hurdle-and-the-stack) |
| G16 | HK tax year (1 Apr–31 Mar) not reflected; quarters only | Wrong grouping for the adviser | Generated `hk_year_of_assessment` (verified) | US-6 |
| G17 | `snack-man.html` attached to the PRD page is an arcade game | Scope confusion | Out of scope. It is a reference **anti-pattern** (points and lives = casino loop) | [03 §6](03-serious-game-design.md#6-scoring-process-over-outcome) |

## 10. Open questions

| ID | Question | Blocks | Default until answered |
|----|----------|--------|------------------------|
| OPEN-1 | Is an IBKR API ToS-clean for third-party **draft** creation? | Mode B/C | Mode A playbook only; `BrokerPort` adapters stubbed |
| OPEN-2 | Options history vendor vs Black-Scholes proxy? | Backtest fidelity | BS proxy, disclosed as `unconfirmed` claim label |
| OPEN-3 | HK tax copy sign-off by an adviser? | Public marketing of SCR-051 | Private use only; copy `v1-draft` |
| OPEN-4 | Hosting region / HK data residency? | Production infrastructure | Local-first (Docker on the user's Mac) |
| OPEN-5 | IBKR Mobile Preview deep link? | Execute polish | Manual "Open IBKR Mobile" text only |
| OPEN-6 (new) | Retention period for agent transcripts? | Privacy | 90 days, then purge job; audit keeps hashes only |
| OPEN-7 (new) | HK SFC perimeter if the product ever serves other users | Multi-user launch | Single-user personal-book mode only |

---

## Cross-references

[00 WHY](00-why-first-principles.md) · [04 UX flows](04-ux-ia-flows.md) · [05 Screens](05-screens-wireframes.md) ·
[13 Edge cases](13-edge-cases.md) · [15 Plan](15-implementation-plan.md) · [16 Traceability](16-traceability.md)
