# 00 · WHY & First Principles

> Read this first. Every later design choice points back to a truth numbered `FP-n` here.
> If a feature cannot be traced to an `FP`, it is a candidate for deletion.

---

## 1. WHY (the five whys)

```
Problem seen: a person hears a clear CSP / wheel story (the Cyrille meeting, 2026-08-27)
              and goes straight to an IBKR Mobile ticket.
   │
   ├─ Why is that dangerous?
   │    Because they cannot yet state what they are signing up for:
   │    reserved cash, max profit, break-even, assignment path, crash loss.
   │
   ├─ Why can't they state it?
   │    Because the knowledge lives in scattered articles and a verbal story,
   │    and nothing forces them to compute it before acting.
   │
   ├─ Why does nothing force it?
   │    Because brokers show numbers without teaching, and articles teach
   │    without gating. Nothing sits between "understood" and "submitted".
   │
   ├─ Why does that gap matter so much for this strategy?
   │    Because a short put is an OBLIGATION. The downside shows up rarely
   │    and all at once (crashes), and the upside is small and frequent.
   │    That asymmetry rewards overconfidence right up to the day it doesn't.
   │
   └─ Why build software rather than write another article?
        Because the fix is behavioural: the tool must (a) make the numbers
        unavoidable, (b) let the person FEEL the left tail in simulation,
        (c) make "do nothing" as easy as "trade", and (d) never act on
        the market itself.
```

**Product promise (from the PRD, kept verbatim):** before selling a cash-secured put, the user
can state maximum profit, break-even price, reserved cash, assignment risk, worst-case loss and
portfolio impact in plain language.

**What we are NOT building:** a signal service, a robo-adviser, an order router or a yield
product. See [01 §7](01-product-spec.md#7-scope-in-out-later).

---

## 2. First principles: what a cash-secured put physically is

Strip the jargon and derive everything from one contract:

```
  SELL 1 put, strike K, expiry T, for premium p (per share), multiplier 100
  ───────────────────────────────────────────────────────────────────────────
  You receive      : p × 100 now                         (it is yours either way)
  You promise      : to BUY 100 shares at K, any time up to T (American style)
  Counterparty     : chooses whether you must honour it (exercise / assignment)

  Therefore, necessarily:
    cash you must hold      = K × 100                    → "Reserve"
    best case               = p × 100                    → "Max profit"
    price where you're flat = K − p                      → "Break-even"
    if shares go to 0       = K × 100 − p × 100          → "Worst case"
    if assigned, you own    = 100 shares at an effective K − p   → "Cost basis"
```

Every screen, rule and test in this spec is a consequence of those five lines.
They are implemented once in `packages/domain` ([02 §2](02-investment-domain.md#2-invariants-the-five-numbers))
and verified by property tests ([appendix spike](appendix/domain-spike/src/domain.test.ts)).

The covered call is the mirror image. Owning 100 shares at basis B and selling a call at strike Kc
promises to SELL at Kc. If Kc < B, being called away **locks in a loss**. That single inequality
explains the whole "basis rule" in [02 §4](02-investment-domain.md#4-the-wheel-state-machine).

---

## 3. First principles: truths that must hold

| ID | Truth (cannot be negotiated) | Consequence in the product | Enforced by |
|----|------------------------------|----------------------------|-------------|
| **FP-1** | A person must not commit to an obligation they cannot state. | The five numbers are computed and shown **above** any score; blank or invalid ⇒ CTA disabled. | `TicketThreeNumbers` ([06](06-ui-design-system.md#5-component-inventory)), US-1, `R-*` rules |
| **FP-2** | The obligation must be fully funded, in the right currency, with no loan. | Cash-secured check against **settled USD**; negative balance in any currency = loan ⇒ halt. | `R-CASH`, `R-FX`, generated `fx_loan_flag` ([09](09-database.md)) |
| **FP-3** | The worst case must be felt before it is risked. | Crash + Monte Carlo attached to the packet before **Prepare draft** (otherwise the draft is `blocked: PACKET_INCOMPLETE`). | `R-PACKET`, `v_memo_packet` |
| **FP-4** | Not trading must be as easy as trading. | Skip is a primary button with equal visual weight; skip reasons logged, never penalised. | US-7, [06 §5](06-ui-design-system.md#5-component-inventory) |
| **FP-5** | The machine never acts on the market. | No submit endpoint or tool exists; probes return 501 and are audited. | [07 §9](07-architecture.md#9-the-no-submit-guarantee), [11 §3](11-agent-llm.md#3-hard-boundaries-and-where-each-is-enforced) |
| **FP-6** | A claim without a source is not a fact. | Quotes, rates and simulation outputs carry source, `as_of` and `model_version`; missing data ⇒ refuse. | cite-or-refuse ([11 §7](11-agent-llm.md#7-citation-guard)), `rate_snapshot.source_url` CHECK |
| **FP-7** | Learning is shown by behaviour, not by pages read. | Mastery comes from evidence rules (correct computations, choices under stress), not completion. | [03 §4](03-serious-game-design.md#4-evidence-model-how-mastery-is-measured) |
| **FP-8** | Good decisions can have bad outcomes (and the reverse). | The game scores **process**, not P&L. Premium earned never earns points. | [03 §6](03-serious-game-design.md#6-scoring-process-over-outcome) |
| **FP-9** | Concentration kills more beginners than bad strikes. | One lot by default (`lots_max=1`); a second lot halts (`SCR-045`). | DB trigger + `R-LOTS` |
| **FP-10** | What happened must be provable later. | Append-only audit with a per-user hash chain; ledger immutable; state change and audit event in the same transaction. | [09 §7](09-database.md#7-audit-trail-append-only-and-hash-chained) |
| **FP-11** | Safety must not depend on the LLM. | Every gate is deterministic code. The LLM explains and never decides; the product stays safe when Ollama is down. | [11 §2](11-agent-llm.md#2-the-one-rule-the-llm-explains-code-decides) |

> Evidence behind FP-11 (measured 2026-09-23, local `qwen3.5:9b-mlx`, JSON-schema output, rules in the system prompt, 5 runs per case):
> an obvious wrong-side + market order was blocked 3/3, and an HKD loan 5/5. But a draft **100 USD short of cash** was passed 3/5 times,
> a **valid** draft was wrongly blocked 4/5 times, and a strike at **12.22% OTM** (band 5–12%) passed 2/5 times.
> The deterministic rule registry gets all of these right every time. See [18 §3](18-references.md#3-verification-log).

---

## 4. Derivation: from truths to product spine

```
 FP-1 state it ──► Learn (SCR-001..006) ──► compute the five numbers yourself
 FP-7 evidence ──► Serious game (SCR-007..012) ──► mastery unlocks Mentor & Live
 FP-3 feel it  ──► Simulate (SCR-020..023) ──► crash + MC attached to a packet
 FP-4 skip     ──► Decide (SCR-030..039, 102) ──► Skip | Wait | Prepare draft
 FP-2 fund it  ──► Checklist rules (R-*) ──► blocked with reasons, or open
 FP-5 no send  ──► Execute (SCR-040..046, 103) ──► YOU submit in IBKR; record fill
 FP-10 prove   ──► Journal (SCR-050..052) ──► audit chain, ledger, HK export
 FP-11 LLM     ──► Agent drawer / SCR-060 ──► explains, cites, refuses
```

## 5. Assumptions vs facts

| Kind | Statement | Status |
|------|-----------|--------|
| Fact | US equity options are American-style: early assignment is possible at any time. | Market structure |
| Fact | QQQ options trade in penny increments. The multiplier is 100. | Market structure |
| Fact | QQQ pays quarterly dividends, so early assignment risk on covered calls rises before ex-dividend dates. | Market structure ([02 §9](02-investment-domain.md#9-market-realities-the-code-must-respect)) |
| Illustrative | Meeting stack of ~2.8–3% premium plus ~3% T-bill ≈ 7–8%. | **Not a guarantee, not a floor** |
| Sourced sim | About 6% median CAGR for puts only, over 10k bootstrap paths (Mobile article / csp-mc). | Educational, not a forecast |
| Assumption | Quiz pass mark ≥ 80%; paper-mastery target ≥ 70% within 30 days. | Locked for MVP; revisit with data |
| Open | IBKR API ToS for third-party draft creation (OPEN-1), options history vendor (OPEN-2), HK tax copy sign-off (OPEN-3), hosting region (OPEN-4), Mobile deep link (OPEN-5). | [01 §10](01-product-spec.md#10-open-questions) |

## 6. How to use this document when in doubt

1. Name the `FP` your change serves.
2. If it weakens any `FP`, stop and write an ADR ([17](17-adr.md)).
3. If it serves none, question whether it belongs in MVP.

---

## Cross-references

[01 Product](01-product-spec.md) · [02 Domain](02-investment-domain.md) · [03 Game](03-serious-game-design.md) ·
[11 Agent](11-agent-llm.md) · [12 Compliance](12-compliance-copy.md) · [13 Edge cases](13-edge-cases.md) · [19 Glossary](19-glossary.md)
