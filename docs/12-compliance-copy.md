# 12 · Compliance, copy and voice (Product Owner + Compliance lens)

> Source: [`Needs/9 Compliance, HK tax & voice`](../Needs/9%20Compliance%2C%20HK%20tax%20%26%20voice/compliance.md).
> This document is **normative** for every user-visible string. Copy lives in one module (`packages/copy/v1.ts`) and is versioned
> (`copy_version = 'v1'`). Changing any approved block below bumps the version and forces a new acknowledgement ([§4](#4-disclosures-and-acknowledgement)).

---

## 1. WHY (compliance lens)

The product teaches people to sell insurance on a stock index with their own savings. Two wrong words ("guaranteed", "we") turn
education into an implied promise or an implied advisory relationship. So copy is treated like code: **one source, versioned, linted, tested**.

```
 Classification (intent): education and decision-support software
   │
   ├─ NOT personalised investment advice       ─► agent refusal (11 §8) + no "you should" copy
   ├─ NOT portfolio management for clients      ─► single personal book, "you"/"I" voice only
   ├─ NOT an order router                       ─► no submit anywhere (07 §9)
   └─ NOT tax advice                            ─► HK tax journal = ledger export + checklist
```

## 2. Approved copy (verbatim)

Keys are stable; the text is copied **verbatim** from the Needs and checked by a snapshot test (`copy.verbatim.test.ts`) against a hash.

| Key | Text | Where |
|-----|------|-------|
| `edu.sticky` | "Education and decision support — **not** personalized investment advice. Confirm live broker preview, permissions, and professional tax/legal advice for your situation." | SCR-000 shell, all pages |
| `claim.meeting_7_8` | "Meeting-sourced illustrative stack (premium + T-bill) ≈ 7–8% — **not a guarantee, not a floor.** Do not annualize one quiet quarter." | SCR-021/022/023/032/037 |
| `claim.article_8_9` | "Teaching target / UNCONFIRMED — not a floor. Past paths ≠ future." | SCR-022/023, SCR-001 |
| `tax.not_advice` | "This tax journal is **educational** for a Hong Kong personal book. It is **not tax advice**. No auto filing. Export for your adviser. Premium treatment under IRO s.14 is uncertain (badges of trade)." | SCR-051, CSV header |
| `sim.not_forecast` | "Simulation, not a forecast. Model `{model_version}`, seed `{seed}`." | every sim result |
| `exec.human_gate` | "EdgeInvest never sends orders. You place the order yourself in IBKR, after checking the live preview." | SCR-040–044 |
| `agent.not_advice` | "The tutor explains numbers and rules. It is not a licensed adviser and cannot place orders." | SCR-060, drawer, SCR-041 |
| `agent.refuse` | "I can't tell you what to trade. I can show the numbers, the risks and what your packet still needs, so you can decide." | agent refusal |
| `agent.offline` | "Agent offline. All safety checks still run." | drawer, SCR-060 |
| `paper.bar` | "SIMULATED — paper account" | Execute when mode = Paper |
| `quarter.no_annualise` | "One quarter is not a year. Annualised figures from a single quarter are hidden." | SCR-046 |

Refuse patterns (Needs §10): life savings ⇒ `agent.refuse` + process + sim; "guarantee 8%" ⇒ `agent.refuse` + `claim.meeting_7_8`;
"just submit" ⇒ `exec.human_gate`; "add a lot to catch up" ⇒ halt education, link SCR-045; "we should allocate firm capital" ⇒ personal-book reminder.

## 3. Return claims policy

```
 any return number shown to a user
   │
   ├─ from a simulation?  ── yes ─► ClaimLabel "sourced simulation" + model_version + seed + "not a forecast"
   ├─ from the meeting?   ── yes ─► ClaimLabel "illustrative (meeting)" + claim.meeting_7_8 (verbatim)
   ├─ article target?     ── yes ─► ClaimLabel "UNCONFIRMED" + claim.article_8_9
   └─ none of the above   ────────► not allowed: remove it (lint CP-YIELD fails the build)
```

| Rule | Detail | Enforced by |
|------|--------|-------------|
| No blended yield | Premium leg and T-bill leg are always shown separately (G15) | `YieldStack` component has no "total" prop; lint CP-BLEND |
| No annualising one quarter | SCR-046 hides annualised figures when the window < 4 quarters | domain `annualise()` returns `null` + reason |
| Forbidden phrases | "risk-free", "IB has no risk", "guaranteed income", "guaranteed", "floor" used as a promise | lint CP-GUAR (UI + agent output) |
| Broker safety | Qualified per Three-Layer: "regulated; the model reduces some risks; it does not eliminate them" | approved block in SCR-003 |
| Outcome ≠ skill | Game results never show P&L as the score ([03 §6](03-serious-game-design.md#6-scoring-process-over-outcome)) | scoring weight 0 test |

## 4. Disclosures and acknowledgement

"Disclosure impressions" (Needs) is ambiguous (G14). Here it is an **explicit, versioned acknowledgement**, not a view count.

| Key | Required before | Screen | Re-ack when |
|-----|-----------------|--------|-------------|
| `edu.sticky` | any `onboarded` route | SCR-101 | `copy_version` or jurisdiction changes |
| `exec.human_gate` | SCR-040–044 | SCR-101 / first Execute visit | version change |
| `agent.not_advice` | first agent turn | drawer, SCR-060 | version change |
| `live.unlock` | Live mode toggle | SCR-072 | every Live enable, and at each Live human gate |
| `tax.not_advice` | first HK export | SCR-051 | version change |

```
 GET /me/capabilities ─► onboarded = acked(edu.sticky, copy_version) ∧ jurisdiction set
        │ false
        ▼
 redirect /welcome (SCR-101) ─► POST /me/disclosures/:key/ack { copy_version }
        │                          ├─ INSERT disclosure_ack (PK user,key,version)  (replay = no-op)
        │                          └─ audit disclosure_acked (same transaction)
        ▼
 capability true ─► route loads; ComplianceBanner shows copy_version
```

- Sticky banner: collapses to a one-line strip per session but never disappears. `required` banners (Execute, Agent, Live) cannot collapse.
- The jurisdiction banner comes from `user.jurisdiction` (HK default). Other jurisdictions show "Content written for Hong Kong residents".
- Every ack and every view of a `required` disclosure writes an audit event (`disclosure_acked`, `disclosure_viewed`).

### Banner matrix (every screen)

| Screens | Banner | Extra |
|---------|--------|-------|
| SCR-100 | footer | `edu.sticky` in the footer |
| SCR-101, SCR-000, 001–012, 020, 030–039, 046, 050, 052, 070, 071, 073 | sticky | – |
| SCR-021, 022, 023, 032, 037 | sticky | ClaimLabel + claim blocks |
| SCR-040–045, SCR-103 | required | `exec.human_gate`; `paper.bar` in Paper; red Live chip in Live |
| SCR-041, SCR-060, drawer | required | `agent.not_advice` |
| SCR-045 | required | halt reason in an `aria-live` region |
| SCR-051 | sticky | `tax.not_advice` at the top and in the CSV header |
| SCR-072 | required (Live) | `live.unlock` |

The registry column `banner` ([05 §1](05-screens-wireframes.md#1-screen-registry)) is the single source; an e2e test visits every route and asserts the matrix.

## 5. Copy lint rules (CI)

Two layers: a **static** lint on source strings (`bun run lint:copy`) and a **rendered** lint in Playwright that scans `document.body.innerText`
and every agent message on every registry route. Both use the same rule table from `packages/copy/lint-rules.ts` (DRY).

| ID | Rule | Pattern (case-insensitive) | Scope |
|----|------|----------------------------|-------|
| CP-CTA | Buttons never say sell/buy/trade/submit/earn | `/^\s*(sell|buy|trade|submit|earn)\b/i` on accessible names of `button`, `a[role=button]` | UI |
| CP-GUAR | No guarantees | `/\b(risk[- ]free|guaranteed?( income)?|IB has no risk|sure thing)\b/i` unless inside "not a guarantee" | UI + agent |
| CP-VOICE | No firm "we" | `/\b(we|our)\s+(fund|LPs?|AUM|capital|clients|manage)\b/i` | UI + agent + docs/content |
| CP-YIELD | Return % needs a ClaimLabel | a `%` within 40 chars of `yield|return|income` outside a `ClaimLabel` subtree | rendered UI |
| CP-BLEND | No single blended yield | `/\b(total|combined|blended)\s+(yield|return)\b/i` | UI + agent |
| CP-CASINO | Anti-casino words | `/\b(jackpot|win big|lucky|streak bonus|beat the market|easy money)\b/i` | UI + game content |
| CP-ADVICE | No imperative advice | `/\byou should (sell|buy|open|roll)\b/i` | UI + agent |
| CP-VERBATIM | Approved blocks unchanged | hash of each §2 block equals `packages/copy/v1.lock.json` | build |

A lint failure fails CI. Exceptions need an entry in `lint-allow.json` with a reason and a reviewer (audited in the PR).

## 6. Hong Kong tax journal (educational)

| Fact (Needs §4) | Product behaviour |
|-----------------|-------------------|
| Premium is not salaries tax; HK has no capital-gains tax | Shown as education text only |
| Profits tax under IRO s.14 may apply if the activity is a trade | "Badges of trade" checklist, answers stored as notes, **no verdict** |
| No published IRD ruling on CSP premium | Stated in `tax.not_advice` |
| French citizenship does not by itself change HK residence | Education text |
| Export for an adviser | CSV grouped by HK year of assessment (1 Apr–31 Mar) and quarter; header = `tax.not_advice`; audit `hk_export` |

The system **never** characterises income as taxable or exempt (no column, no field, no agent tool for it).

## 7. Audit events required by compliance

Envelope changes, draft created/blocked, skips, disclosure viewed/acked, exports, agent refusals and agent blocked drafts, mode changes,
halt raised/cleared. All in the hash-chained `audit_event` ([09 §7](09-database.md#7-audit-trail-append-only-and-hash-chained)).

## 8. Open legal questions (not blocking MVP)

| Item | Status | Product stance until resolved |
|------|--------|-------------------------------|
| HK SFC advisory perimeter for multi-user SaaS | Open | Single-user personal book; no public sign-up in MVP |
| IBKR API terms for third-party draft tooling | Open | No IBKR API integration at all; manual copy of values |
| EU/FR marketing if content reaches EU residents | Open | Jurisdiction banner; no marketing surface in MVP |

---

## Cross-references

[00 FP-5/FP-6](00-why-first-principles.md#3-first-principles-truths-that-must-hold) · [04 Microcopy](04-ux-ia-flows.md#9-microcopy-rules) ·
[06 ClaimLabel](06-ui-design-system.md) · [11 Output guards](11-agent-llm.md#8-output-guards-and-refusal) · [13 EC-CP](13-edge-cases.md#ec-cp-compliance-and-copy) ·
[14 E2E](14-test-strategy.md#5-end-to-end-playwright)
