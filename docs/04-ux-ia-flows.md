# 04 · UX: Information Architecture & Flows (UX Designer lens)

> Source: [`Needs/4 UX`](../Needs/4%20UX%20IA%20wireframes/ux.md) (42 unique SCR IDs). This document adds the 4 missing screens
> (`SCR-100..103`), the gates, the journeys and every non-happy state. Wireframes: [05](05-screens-wireframes.md). Components: [06](06-ui-design-system.md).

---

## 1. WHY (UX lens)

The user is competent elsewhere and "suddenly stupid at Preview" (Needs storyboard, frame 2). The UX must make the **right action the
easy action**: numbers first, Skip as prominent as Prepare, danger behind friction, and **no dead ends**. Every blocked state explains why and what to do next.

## 2. Principles (Needs 1–10, plus four we add)

| # | Principle | Testable as |
|---|-----------|-------------|
| 1 | WHY before HOW on every major surface | Each area index opens with an intent card |
| 2 | Five numbers visible on any ticket-like view, above any score | DOM-order e2e assertion (US-1) |
| 3 | Skip is primary, with equal weight | Same component variant + size; first in tab order |
| 4 | Calm, non-casino feedback | Copy lint + anti-casino checklist ([03 §6](03-serious-game-design.md#6-scoring-process-over-outcome)) |
| 5 | Compliance banner is sticky; not dismissible on Execute / Agent draft surfaces | Screen registry `bannerDismissible=false` |
| 6 | Desktop copy mirrors IBKR Mobile step language | Playbook strings come from one copy module |
| 7 | Envelopes always labelled; Beginner default | `EnvelopeBadge` in chrome |
| 8 | Paper default, human gate, no auto-send | FP-5 |
| 9 | ~7–8% illustrative only; unsourced = UNCONFIRMED | `ClaimLabel` component required on any rate |
| 10 | HK tax educational; never "we" for firm capital | Copy lint rule `CP-VOICE` |
| **11** | **No dead ends**: every blocked/empty/error state names the cause and one next action | State matrix §6 is a test fixture |
| **12** | **Server decides, UI reflects**: gates come from `GET /me/capabilities`, never re-derived in components | [08 §4](08-frontend-architecture.md#4-guards-capabilities-drive-routes) |
| **13** | **Time is explicit**: every quote/rate shows `as of` in HKT **and** ET | `AsOfStamp` component |
| **14** | **Keyboard first** for the decision path | Focus order PhaseChip → numbers → Skip → Prepare |

## 3. Information architecture

### 3.1 Navigation map (46 screens, every leaf = SCR-ID + route)

```
(public)
  └─ Sign in ................................ SCR-100  /sign-in
(app shell) SCR-000  /_app  ── chrome: Phase · lots · Reserved/Leftover · Envelope · Mode · Banner · Agent drawer
  ├─ First run .............................. SCR-101  /welcome
  ├─ Learn
  │   ├─ WHY ................................ SCR-001  /learn/why
  │   ├─ Seven words ........................ SCR-002  /learn/seven-words
  │   ├─ Three-layer stack .................. SCR-003  /learn/three-layer
  │   ├─ CSP arithmetic ..................... SCR-004  /learn/arithmetic
  │   ├─ Wheel / covered call ............... SCR-005  /learn/wheel
  │   ├─ Quizzes ............................ SCR-006  /learn/quizzes/$module
  │   └─ Serious game
  │       ├─ Hub ............................ SCR-007  /learn/game
  │       ├─ Tutorial ....................... SCR-008  /learn/game/tutorial
  │       ├─ Scenario / paper lab (put leg) . SCR-009  /learn/game/scenario/$scenarioId
  │       ├─ Crash .......................... SCR-010  /learn/game/crash/$scenarioId
  │       ├─ Committee ...................... SCR-011  /learn/game/committee
  │       └─ Post-assign (call leg) ......... SCR-012  /learn/game/post-assign
  ├─ Simulate
  │   ├─ Payoff lab ......................... SCR-020  /simulate/payoff
  │   ├─ Crash history ...................... SCR-021  /simulate/crash
  │   ├─ Monte Carlo ........................ SCR-022  /simulate/monte-carlo
  │   └─ Backtest ........................... SCR-023  /simulate/backtest
  ├─ Decide
  │   ├─ Inputs (quotes, rate, balances) .... SCR-102  /decide/inputs            ← new
  │   ├─ Account snapshot ................... SCR-030  /decide/snapshot
  │   ├─ Put candidates ..................... SCR-031  /decide/candidates
  │   ├─ Put packet ......................... SCR-032  /decide/packet/$memoId
  │   ├─ Memo history (incl. skips) ......... SCR-033  /decide/history
  │   └─ Share phase (visible when shares-held)
  │       ├─ Assignment & basis ............. SCR-034  /decide/assignment/$cycleId
  │       ├─ Willingness .................... SCR-035  /decide/willingness
  │       ├─ Call candidates ................ SCR-036  /decide/call-candidates
  │       ├─ Call packet .................... SCR-037  /decide/call-packet/$memoId
  │       ├─ Call ticket numbers ............ SCR-038  /decide/call-ticket/$draftId
  │       └─ Put UI lock notice ............. SCR-039  /decide/put-lock
  ├─ Execute
  │   ├─ IBKR Mobile put playbook ........... SCR-040  /execute/put-playbook/$draftId
  │   ├─ Draft coach ........................ SCR-041  /execute/draft-coach/$draftId
  │   ├─ Human gate ......................... SCR-042  /execute/human-gate/$draftId
  │   ├─ IBKR Mobile call playbook .......... SCR-043  /execute/call-playbook/$draftId
  │   ├─ Short-call lifecycle ............... SCR-044  /execute/short-call-life/$cycleId
  │   ├─ Short-put lifecycle + record fill .. SCR-103  /execute/short-put-life/$cycleId  ← new
  │   ├─ Veto / halt ........................ SCR-045  /execute/halt
  │   └─ Quarterly ledger ................... SCR-046  /execute/quarterly-ledger
  ├─ Journal
  │   ├─ Audit log .......................... SCR-050  /journal/audit
  │   ├─ HK tax export ...................... SCR-051  /journal/tax-hk
  │   └─ Lessons learned .................... SCR-052  /journal/lessons
  ├─ Agent (full screen) .................... SCR-060  /agent
  └─ Me
      ├─ Settings ........................... SCR-070  /me/settings
      ├─ Envelope ........................... SCR-071  /me/envelope
      ├─ Paper / Live mode .................. SCR-072  /me/mode
      └─ Compliance & disclosures ........... SCR-073  /me/compliance
```

### 3.2 Global chrome (SCR-000)

```
+--------------------------------------------------------------------------------------------+
| EdgeInvest   Learn  Simulate  Decide  Execute  Journal  Agent  Me          [PAPER] (R) ▾   |
+--------------------------------------------------------------------------------------------+
| [cash-put]  Lots 0/1  Reserved USD 0 · Leftover USD 100,000  Env: Beginner 5–12% (DEFAULT) |
| (!) HALT: fx_loan: resolve on Snapshot →          (only when halted; aria-live=polite)     |
+------------------------------------------------------------------+-------------------------+
| content canvas (max 1200 px)                                     | Agent drawer (toggle ⌘J)|
|                                                                  | mode: Ask|Ticket|…      |
+------------------------------------------------------------------+-------------------------+
| Education / decision support: NOT investment advice. Options can lose more than premium.   |
| copy v1 · [details]                             (sticky; not dismissible on Execute/Agent) |
+--------------------------------------------------------------------------------------------+
```

## 4. Journeys

### 4.1 First run → first paper-ready packet (happy path)

```
 SCR-100 sign in ─► SCR-101 welcome
                     │ 1 WHY promise card  2 jurisdiction = HK  3 ack disclosures (copy v1)  4 start cash (paper lab)
                     ▼
 SCR-001 WHY ─► 002 words ─► 003 three-layer ─► 004 arithmetic ─► 005 wheel ─► 006 quizzes (≥80 %)
                                                                                     │ fail → remediation card → retry
                                                                                     ▼
 SCR-007 hub ─► 008 tutorial ─► 009 scenario ─► 010 crash ─► 011 committee ─► 009→012 paper lab (full wheel)
                                                                                     │ mastery_all_pass
                                                                                     ▼
                                                       Mentor unlocked (SCR-071) · Live eligible (SCR-072)
```

### 4.2 Monthly put decision (core loop; paper or live mode)

```
 SCR-102 inputs ──► SCR-030 snapshot ──► SCR-031 candidates ──► POST /memos ──► SCR-032 packet
  quotes+as_of       settled USD, FX      in-envelope ranked      memo created      ┌───────────────────────────┐
  rate+https src     loan? level?         rejects greyed          (building)        │ five numbers (selected)   │
        │                 │ fx_loan                │ empty chain                    │ crash [attach] mc [attach]│
        │ stale?          ▼                        ▼                                │ pre-commitment plan       │
        └─► refresh   SCR-045 halt            "No quote, refusing                   │ [Skip ▾] [Wait] [Prepare] │
                                               to invent one" + link SCR-102        └──────┬──────┬──────┬──────┘
                                                                                           │      │      │
                           skip reason ─► memo decided(skip) ─► SCR-033 ◄──────────────────┘      │      │
                           wait ─► memo decided(wait) ─► reminder (none automated in MVP) ◄───────┘      │
                                                                                                         ▼
          POST /drafts ─► checklist (R-*) ─► blocked? ─yes─► SCR-041 shows reasons (+ SCR-045 if halt raised)
                                               │ no
                                               ▼
          SCR-040 playbook (steps, paper bar) ─► SCR-041 coach (agent critique, optional) ─► SCR-042 human gate
                                                                                              │ "I submitted in IBKR"
                                                                                              ▼
                                                              SCR-103 record fill (price, time) ─► cycle short_put_open
```

### 4.3 Short-put lifecycle → assignment → covered call

```
 SCR-103 (open short put)
   ├─ expired worthless ────────────────► cycle closed ─► phase cash-put ─► back to 4.2
   ├─ bought back (BUY-to-close draft) ─► human gate ─► fill ─► closed
   ├─ roll (BUY-close + SELL-open, in envelope) ─► two fills ─► same cycle
   ├─ not filled ─► draft discarded (no cycle)
   └─ assigned (any day) ─► SCR-034 confirm basis = K − net credit ─► phase shares-held
                                │
                                ▼
                     SCR-039 put UI locked (redirect target for all put routes)
                     SCR-035 willingness ── decline ──► SCR-045 halt willingness_declined
                                │ accept
                                ▼
                     SCR-036 call candidates (filter strike ≥ basis) ─► SCR-037 call packet [Skip][Wait][Prepare]
                                │                                        strike < basis ⇒ SCR-045 locked-loss accept
                                ▼
                     SCR-038 call ticket ─► SCR-043 call playbook ─► SCR-042 human gate ─► fill
                                ▼
                     SCR-044 short-call life: expire → shares-held (new call) · close · roll · called away → closed → cash-put
```

### 4.4 Halt and recovery

```
  condition detected (use case or snapshot) ─► wheel_state.halt_reason set + audit halt_raised
       │
       ▼
  Chrome HaltBanner (aria-live) ─► SCR-045 explains: cause · evidence · the ONE action that clears it
       │                                    fx_loan         → convert in IBKR, then new snapshot on SCR-102
       │                                    level_gap       → upgrade permission, then new snapshot
       │                                    second_lot_…    → close a cycle or fund + P1 lots_max change
       │                                    willingness_…   → re-affirm on SCR-035 (new confirmation)
       │                                    paper_bar_missing → confirm the paper bar on SCR-040 precheck
       ▼
  [Re-check] ─► server re-evaluates ─► still true ⇒ 409 HALT_CONDITION_PERSISTS · false ⇒ halt_cleared audited
```

### 4.5 Agent offline (US-12)

```
 drawer open ─► GET /agent/status → { available:false } ─► banner "Agent offline. All safety checks still run."
 SCR-041 critique block ─► "not available" (neutral); checklist from code still renders; Prepare/Continue unaffected
```

## 5. Gates and locks

Capabilities come from the server (`GET /me/capabilities`) and feed route guards and component visibility. They are one source ([08 §4](08-frontend-architecture.md#4-guards-capabilities-drive-routes)).

| Capability | True when | Guards | When false |
|------------|-----------|--------|------------|
| `authenticated` | valid session | all `/_app/*` | redirect `/sign-in?redirect=…` |
| `onboarded` | disclosures acked for current `copy_version` + jurisdiction set | all except `/welcome`, `/me/compliance` | redirect `/welcome` |
| `phase_cash_put` | no open cycle in shares states | SCR-031, 032 (new), 040 | redirect SCR-039 |
| `phase_shares_held` | open cycle in `shares_held`/`shares_short_call` | SCR-034…038, 043, 044 | page shows "No shares held yet: the basis rule does not apply" |
| `mentor_selectable` | `mastery_all_pass` | SCR-071 Mentor radio | locked + link SCR-007; override path (two-step, audited) |
| `live_eligible` | mastery + all Execute disclosures acked | SCR-072 Live toggle | disabled + reasons listed |
| `can_prepare_draft` | not halted ∧ packet complete ∧ inputs fresh | Prepare button | disabled + reason tooltip, also enforced by API |
| `agent_available` | Ollama reachable | drawer tools | offline banner (4.5) |
| `halted` | `halt_reason` set | every Prepare/Continue | `HaltBanner` + SCR-045 |

## 6. States every screen must design (test fixture)

| State | Trigger | Pattern | Example copy |
|-------|---------|---------|--------------|
| Loading | query pending > 150 ms | Skeleton with the **numbers block shape** first | – |
| Empty (teach) | no rows | Explain + one next action | "No memos yet. Skip is a valid decision." |
| Empty chain | no bid/ask | Refuse, link to inputs | "No quote, refusing to invent one. Add quotes on Inputs." |
| Stale | `as_of` beyond window | Amber `AsOfStamp` + disable scoring | "Quotes from 21:04 HKT (09:04 ET) are stale. Refresh." |
| Blocked | rule failures | `ChecklistPanel` with reason → fix link | "WRONG_SIDE: an opening put must be SELL." |
| Halted | halt set | `HaltBanner` + SCR-045 | "Halted: FX loan detected on USD." |
| Error (problem+json) | 4xx/5xx | Title + detail + `traceId`; retry if idempotent | "Something failed on our side. Nothing was sent to any broker." |
| Offline (network) | fetch fails | Keep last data, read-only, banner | "You are offline. Changes are paused." |
| Conflict | 409 `STALE_WRITE` | Reload latest, show diff | "This memo changed in another tab." |
| Locked | capability false | Lock icon + unlock path | "Mentor locked until mastery. Go to game hub." |

## 7. Responsive strategy

| Area | Primary device | Layout |
|------|----------------|--------|
| Learn, Simulate, Decide, Journal | Desktop ≥ 1024 px | Two columns; drawer docked right |
| Execute playbooks (SCR-040/043) | **Phone** (used next to IBKR Mobile) | Single column, step cards, large touch targets (44 px) |
| Human gate, lifecycles | Both | Single column, sticky action bar |
| Agent | Both | Drawer on desktop, full screen (SCR-060) on mobile |

## 8. Accessibility (WCAG 2.2 AA)

- Focus order on decision screens: `PhaseChip → TicketThreeNumbers + WorstCaseLine → Skip → Wait → Prepare draft`.
- Never colour alone: phase, profit/loss and severity carry text or icons.
- `aria-live="polite"` for halt and staleness changes; `assertive` only for blocking errors after submit.
- Numeric inputs: `inputMode="decimal"`, monospace tabular figures, and a visible unit (USD, %, days).
- Charts (payoff, MC fan) ship with a data-table alternative and a text summary (p05/p50/p95).
- Target size ≥ 24 px (WCAG 2.2 SC 2.5.8); 44 px on the Execute mobile layout.
- Reduced motion: no animated counters; chart transitions off when `prefers-reduced-motion`.
- Automated axe check on every route in e2e ([14 §5](14-test-strategy.md#5-end-to-end-playwright)).

## 9. Microcopy rules

| Do | Don't |
|----|-------|
| "Prepare draft", "Open IB preview coach" | «Sell», «Trade now», «Earn» |
| "Max profit USD 980 (before fees)" | "Earn USD 980" |
| "Illustrative (meeting), not a guarantee, not a floor" | "7–8% yield" |
| "Skip this month" | "Miss out" |
| "You" / "your personal book" | "We" (firm capital) |
| Name the rule and the fix | "Invalid" |

---

## Cross-references

[01 Stories](01-product-spec.md#5-user-stories) · [05 Wireframes](05-screens-wireframes.md) · [06 Components](06-ui-design-system.md#5-component-inventory) ·
[08 Routes & guards](08-frontend-architecture.md) · [12 Copy](12-compliance-copy.md) · [13 EC-UX](13-edge-cases.md#ec-ux-user-experience)
