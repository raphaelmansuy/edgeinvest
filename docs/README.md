# EdgeInvest: specification set

A learning, simulation and **human-gated** decision tool for cash-secured puts (CSP) and the
QQQ wheel on Interactive Brokers (IBKR). It is education and decision support, **not** investment advice.

| Field | Value |
|-------|-------|
| Status | Spec complete, ready to build (no application code yet) |
| Date | 2026-09-23 (HKT) |
| Source needs | [`../Needs/`](../Needs/) (PRD v0.3, 9 companion pages, IMPL-READY scorecard) |
| Stack | Vite 8.3 · Bun 1.4 · React 19.3 · TanStack Router/Query/Form/Table · Tailwind 4.3 · PostgreSQL 18.6 + pgvector 0.8.6 · Docker Compose · Ollama `qwen3.5:9b-mlx` |
| Verified | Schema run on PG 18.6 (31/31 behaviour checks, concurrency race, RLS view-leak demo, audit-chain tamper test), domain core 31/31 `bun test`, Compose + Dockerfile validated, Ollama verdict and tool-call probes. See [18 §3](18-references.md#3-verification-log) |

---

## 1. Reading order

Start with WHY, then read your own lens. Every document starts with its **WHY** and ends with **Cross-references**.

```
                         +-----------------------------+
                         | 00 WHY & First Principles   |  read first (everyone)
                         +--------------+--------------+
                                        |
        +-------------------+-----------+-----------+-------------------+
        |                   |                       |                   |
+-------v-------+   +-------v--------+     +--------v-------+   +-------v--------+
| 01 Product    |   | 02 Investment  |     | 03 Serious     |   | 12 Compliance  |
|    (PO)       |   |    domain      |     |    game        |   |    & copy      |
+-------+-------+   +-------+--------+     +--------+-------+   +-------+--------+
        |                   |                       |                   |
        +---------+---------+-----------+-----------+---------+---------+
                  |                     |                     |
          +-------v-------+     +-------v-------+     +-------v-------+
          | 04 UX / IA    |     | 07 Architect. |     | 10 Simulation |
          | 05 Screens    |     | 08 Frontend   |     | 11 Agent/LLM  |
          | 06 UI system  |     | 09 Database   |     |               |
          +-------+-------+     +-------+-------+     +-------+-------+
                  |                     |                     |
                  +----------+----------+----------+----------+
                             |                     |
                     +-------v-------+     +-------v-------+
                     | 13 Edge cases |---->| 14 Tests      |
                     +-------+-------+     +-------+-------+
                             |                     |
                             +----------+----------+
                                        |
                             +----------v----------+
                             | 15 Implementation   |
                             | 16 Traceability     |
                             | 17 ADRs · 18 Refs   |
                             +---------------------+
```

## 2. Document map

| # | Document | Lens | Answers |
|---|----------|------|---------|
| 00 | [WHY & First Principles](00-why-first-principles.md) | Everyone | Why does this exist? Which truths must never break? |
| 01 | [Product spec](01-product-spec.md) | Product Owner | Who, what, stories (Given/When/Then), scope, metrics, gaps found in Needs |
| 02 | [Investment domain](02-investment-domain.md) | Investment Expert | Formulas, wheel state machine, envelopes, T-bill hurdle, market realities |
| 03 | [Serious game design](03-serious-game-design.md) | Serious Game Expert | Competencies, evidence, game loops, mastery, anti-casino rules |
| 04 | [UX: IA & flows](04-ux-ia-flows.md) | UX Designer | Navigation, journeys, gates, states |
| 05 | [Screens & wireframes](05-screens-wireframes.md) | UX / UI | ASCII wireframes for all 46 screens |
| 06 | [UI design system](06-ui-design-system.md) | UI + Front-end Designer | Tokens (Tailwind 4 `@theme`), components, a11y, motion |
| 07 | [Architecture](07-architecture.md) | Full-stack Developer | Containers, monorepo, layers, SOLID, API, security |
| 08 | [Front-end architecture](08-frontend-architecture.md) | Full-stack Developer | TanStack Router/Query/Form/Table, guards, state ownership |
| 09 | [Database](09-database.md) | Database Expert | PG18 schema, constraints, RLS, audit chain, migrations |
| 10 | [Simulation engines](10-simulation-engines.md) | Investment + Developer | Payoff, crash, Monte Carlo, backtest algorithms |
| 11 | [Agent & LLM](11-agent-llm.md) | Developer + Compliance | Ollama topology, tools, guards, RAG, evaluation |
| 12 | [Compliance & copy](12-compliance-copy.md) | Compliance | Banners, approved copy, lint rules, HK tax |
| 13 | [Edge-case catalog](13-edge-cases.md) | Everyone | Every edge case: mitigation + test ID |
| 14 | [Test strategy](14-test-strategy.md) | Developer / QA | Test pyramid, e2e, traceability gate |
| 15 | [Implementation plan](15-implementation-plan.md) | Everyone | Epics, vertical slices, Definition of Done, timeline |
| 16 | [Traceability matrix](16-traceability.md) | Everyone | Story → Screen → Route → API → Table → Rule → Test |
| 17 | [Architecture decisions](17-adr.md) | Developer | ADR-001… with alternatives rejected |
| 18 | [References](18-references.md) | Everyone | Official docs, versions, verification log |
| 19 | [Glossary](19-glossary.md) | Everyone | Terms, IDs, abbreviations |
| A | [`appendix/sql/001_init.sql`](appendix/sql/001_init.sql) | DB | Verified baseline migration (PG 18.6) |
| A | [`appendix/sql/verify_behaviour.sql`](appendix/sql/verify_behaviour.sql) | DB | 31 behaviour assertions run as `edge_app` |
| A | [`appendix/domain-spike/`](appendix/domain-spike/) | Developer | Verified domain core: money, invariants, rules, wheel, Monte Carlo |

## 3. ID conventions (used everywhere)

| Prefix | Meaning | Defined in |
|--------|---------|-----------|
| `FP-n` | First-principle truth | [00 §3](00-why-first-principles.md#3-first-principles-truths-that-must-hold) |
| `US-n`, `AUTH-1` | User story | [01 §5](01-product-spec.md#5-user-stories) |
| `SCR-nnn` | Screen (42 from Needs + 4 new `SCR-10x`) | [05](05-screens-wireframes.md) |
| `EC-XX-nnn` | Edge case | [13](13-edge-cases.md) |
| `R-xxx` | Draft checklist rule | [02 §8](02-investment-domain.md#8-draft-checklist-rules) |
| `En`, `F0`, `En-Tn` | Epic, walking skeleton, task | [15](15-implementation-plan.md) |
| `ADR-nnn` | Architecture decision | [17](17-adr.md) |
| `C-xxx` | Competency evidence rule | [03 §4](03-serious-game-design.md#4-evidence-model-how-mastery-is-measured) |

**Test naming contract:** every test title carries the IDs it proves, e.g.
`test("[US-1][EC-IV-001] worst case = reserve − max profit", …)`. CI fails if any `EC-*` in
[13](13-edge-cases.md) has no test carrying its ID ([14 §6](14-test-strategy.md#6-traceability-gate-ci)).

## 4. Locked decisions (inherited from Needs, do not reopen)

| Decision | Value | Where enforced |
|----------|-------|----------------|
| Default envelope | Beginner 5–12% OTM until mastery, then Mentor 16–30% (override needs confirmation and is audited) | [02 §5](02-investment-domain.md#5-strategy-envelopes), [09 §5](09-database.md#5-temporal-envelope-history-pg18) |
| CTA verbs | **Prepare draft** / **Open IB preview coach**, never «Sell» | [12 §5](12-compliance-copy.md#5-copy-lint-rules-ci) |
| `lots_max` | **1** default; `fill_cash` is a dangerous mode, audited | [02 §6](02-investment-domain.md#6-sizing-lots-and-willingness), DB trigger |
| ~7–8% / ~8–9% | Illustrative / target / UNCONFIRMED; not a floor; no blended one-number yield | [12 §3](12-compliance-copy.md#3-return-claims-policy) |
| Live orders | Never sent by the app; Paper default; human gate | [07 §9](07-architecture.md#9-the-no-submit-guarantee) |
| Skip | Primary action on put and call packets | [06 §5](06-ui-design-system.md#5-component-inventory) |
| Empty chain | Refuse, never invent a quote | `R-CHAIN`, [13 EC-MD-001](13-edge-cases.md#ec-md-market-data) |

## 5. What this spec adds to Needs

The Needs pages are the product source of truth. This set makes them buildable on the chosen stack
and closes the gaps found during analysis ([01 §9](01-product-spec.md#9-gap-analysis-of-needs)).
The gaps that matter most:

1. **No fill recording.** The app never learned the actual fill price, so cost basis would have used the draft limit price. Fixed by adding `SCR-103` and `US-10`.
2. **No short-put lifecycle screen.** Only calls had one (`SCR-044`). Also fixed by `SCR-103`.
3. **No market-data input in MVP.** Candidates needed a chain source, but broker sync is P1. Fixed by `SCR-102` with cite-or-refuse rules.
4. **Stored facts that should be derived.** `packet_complete`, `target_funded`, `reserved_usd` and `leftover_usd` were stored columns that can drift. Now derived ([09 §3](09-database.md#3-derive-dont-store)).
5. **No pre-commitment.** The Mobile playbook's written "−20% in week two" plan is now a required field (`US-11`).
6. **Auth undefined.** `AUTH-1` and `SCR-100`/`SCR-101` added.
