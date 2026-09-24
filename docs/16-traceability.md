# 16 · Traceability matrix (everyone)

> Story → Screen → Route → API → Table → Rule → Test. This hand-written matrix is the **design intent**. CI regenerates
> `docs/16-traceability.generated.md` from executed test tags ([14 §6](14-test-strategy.md#6-traceability-gate-ci)); a PR that changes one without
> the other shows the drift in the diff.

---

## 1. WHY

A spec with 46 screens, 13 stories, 20 rules and 120+ edge cases is only trustworthy if every requirement can be followed down to a line of
code and a test, and every test can be followed back up to a reason. This page is that path in both directions.

```
 Needs page ─► FP truth ─► Story ─► Screen ─► Route ─► API ─► Use case ─► Table / constraint ─► Rule ─► EC ─► Test
      ▲                                                                                                  │
      └────────────────────────── every test title carries [US-…][EC-…][SCR-…] ◄──────────────────────────┘
```

## 2. Forward matrix (stories)

| Story | Screens | Routes | API | Tables / views | Rules | Edge cases | Tests |
|-------|---------|--------|-----|----------------|-------|-----------|-------|
| AUTH-1 Sign in | 100, 101, 000, 070, 073 | `/sign-in`, `/welcome`, `/me/settings`, `/me/compliance` | `POST /auth/sign-in\|sign-out`, `GET/PATCH /me`, `POST /me/disclosures/:key/ack`, `GET /me/capabilities` | `app_user`, `credential`, `session`, `disclosure_ack`, `audit_event` | – | EC-SEC-001/003/004/005/006, EC-CP-001/005, EC-UX-005 | E J1 · C auth · I auth bootstrap |
| US-1 Five numbers | 001–006, 008, 009, 020, 031 | `/learn/*`, `/simulate/payoff`, `/decide/candidates` | `POST /calc/invariants`, `POST /sim/payoff`, `POST /quiz/:module/attempts` | `quiz_attempt`, `competency_evidence`, `mastery_progress` | – | EC-IV-001…004, EC-MN-001…004, EC-UX-001, EC-LN-001/002 | P invariants · U money · E J1/J2 |
| US-2 Beginner → Mentor | 003, 007, 071, 023 | `/learn/three-layer`, `/learn/game`, `/me/envelope` | `GET /mastery`, `PATCH /me/envelope` | `envelope`, `envelope_selection` (temporal), `mastery_progress` | R-OTM, R-DTE | EC-EN-001…005, EC-LN-003/004, EC-DB-002 | U rules · I temporal PK · E SCR-071 |
| US-3 Crash + MC before draft | 010, 021, 022, 023, 030, 032 | `/simulate/*`, `/decide/packet/$memoId` | `POST /sim/crash\|mc\|backtest`, `PUT /memos/:id/stress/:kind` | `stress_result`, `memo_stress`, `v_memo_packet`, `job` | R-PACKET | EC-PK-001/003, EC-SM-001…008, EC-DB-007 | U sim · P MC · I stress · E J2 |
| US-4 Playbooks | 005, 038, 040, 043, 072 | `/execute/put-playbook/$id`, `/execute/call-playbook/$id` | `GET /drafts/:id`, `POST /drafts/:id/steps` | `draft_preview` | R-LEVEL, R-MODE | EC-DR-004/005, EC-CP-002/003, EC-WH-004 | E J2/J3 · C steps |
| US-5 Agent reviews, never submits | 041, 042, 060, 000 | `/execute/draft-coach/$id`, `/execute/human-gate/$id`, `/agent` | `POST /drafts/:id/review`, `POST /drafts/:id/human-gate`, `POST /agent/chat`, `ANY /orders/*` | `draft_preview`, `agent_message`, `audit_event` | all block rules | EC-DR-006, EC-AG-001…007, EC-SEC-008, EC-CP-001 | U guards · E J2/J6 · E no-submit probe · L red team |
| US-6 HK tax journal | 046, 051, 073 | `/execute/quarterly-ledger`, `/journal/tax-hk` | `GET /ledger?group=quarter\|hk_yoa`, `PUT /ledger/:id/annotation`, `GET /journal/tax/hk.csv` | `ledger_entry`, `tax_annotation`, `v_ledger_by_quarter`, `v_ledger_by_hk_yoa` | – | EC-LG-001…005, EC-CP-004, EC-DB-011 | I ledger views ✓ · C CSV · E J5 |
| US-7 Skip first-class | 011, 031, 032, 033, 036, 037, 050 | `/decide/*`, `/learn/game/committee`, `/journal/audit` | `POST /memos/:id/skip`, `GET /memos` | `decision_memo`, `memo_skip`, `skip_reason_code` | – | EC-PK-004…006, EC-UX-002 | I skip note ✓ · E J5 |
| US-8 Assignment → basis → call | 012, 034–039, 044, 045 | `/decide/assignment/$cycleId` … `/execute/halt` | `POST /cycles/:id/events`, `POST /wheel/willingness`, `POST /wheel/locked-loss-accept`, `DELETE /wheel/halt` | `wheel_cycle`, `option_leg`, `share_lot`, `wheel_state`, `allowed_transition` | R-PHASE, R-BASIS, R-EXDIV, R-ITM, R-HALT | EC-WH-001…010, EC-IV-004, EC-DB-004 | U wheel ✓ · I transitions ✓ · E J3/J4 |
| US-9 Inputs, cite or refuse | 102, 030 | `/decide/inputs`, `/decide/snapshot` | `POST /inputs/*`, `GET /inputs/*/latest` | `account_snapshot`, `market_snapshot`, `option_quote`, `rate_snapshot` | R-CHAIN, R-STALE, R-ACCT, R-CASH, R-FX, R-ALLOW | EC-MD-001…008, EC-CS-001…004, EC-TM-001…004 | I quotes/rates ✓ · U rules ✓ · E J2 |
| US-10 Fill + short-put life | 103 | `/execute/short-put-life/$id` | `POST /drafts/:id/fill`, `POST /cycles/:id/events` | `option_leg`, `wheel_cycle`, `ledger_entry` | R-LOTS | EC-DR-007, EC-WH-001/002/003/007, EC-LG-002 | U basis ✓ · I race ✓ · E J2 |
| US-11 Pre-commitment | 032, 103 | `/decide/packet/$memoId` | `POST /memos/:id/decide` | `decision_memo` | – | EC-PK-004 | I plan CHECK ✓ · E J2 |
| US-12 Agent offline | 060, drawer, all | `/agent` | `GET /agent/status` | – | – | EC-AG-008/011, EC-OPS-003 | E J6 with `AGENT_PROVIDER=off` |

## 3. First principles → enforcement → proof

| FP | Truth (short) | Enforced in | Proof |
|----|---------------|-------------|-------|
| FP-1 | State the obligation first | `invariants()`, `TicketThreeNumbers` before any score, CTA disabled on invalid | EC-IV-001…004, EC-MN-001…004, EC-UX-001 |
| FP-2 | Fully funded, right currency, no loan | R-CASH, R-FX, R-ACCT, halt `fx_loan` | EC-CS-001…004 |
| FP-3 | Feel the worst case first | R-PACKET, `v_memo_packet` | EC-PK-001, EC-PK-003 |
| FP-4 | Not trading is as easy as trading | `DecisionBar`, `SkipDialog`, skip never penalised | EC-UX-002, EC-PK-006 |
| FP-5 | The machine never acts on the market | no submit path, 7 layers ([07 §9](07-architecture.md#9-the-no-submit-guarantee)) | EC-SEC-008, EC-AG-001 |
| FP-6 | A claim without a source is not a fact | cite-or-refuse CHECKs, `ClaimLabel`, citation guard | EC-MD-001/006, EC-CP-002, EC-AG-003 |
| FP-7 | Learning is shown by behaviour | evidence rules C-*, mastery projection | EC-LN-001…004 |
| FP-8 | Process over outcome | scoring weights, outcome weight 0 | EC-LN-005, scoring unit test |
| FP-9 | Concentration kills beginners | R-LOTS, `wheel_cycle_guard`, `fill_cash` sim-only | EC-WH-003 (race), EC-SM-006 |
| FP-10 | What happened is provable later | hash-chained audit, immutable ledger, reproducible sims | EC-DB-003/005/006, EC-LG-004, EC-SM-001 |
| FP-11 | Safety does not depend on the LLM | rule registry in code; agent advisory | EC-AG-004, EC-AG-008, probe log [18 §3](18-references.md#3-verification-log) |

## 4. Rules → edge case → test

| Rule | Code | EC | Test title (planned) |
|------|------|----|----------------------|
| R-SIDE | `WRONG_SIDE` | EC-DR-001 | `[EC-DR-001] BUY to open` ✓ |
| R-LMT | `NOT_LIMIT` | EC-DR-002 | `[EC-DR-002] market order` ✓ |
| R-TICK | `OFF_TICK` | EC-MN-003 | `[EC-MN-003] penny tick detection` ✓ |
| R-CHAIN | `EMPTY_CHAIN` | EC-MD-001 | `[EC-MD-001] empty chain` ✓ |
| R-STALE | `CHAIN_STALE` | EC-MD-002 | `[EC-MD-002] quote older than window` |
| R-PHASE | `PHASE_MISMATCH` | EC-WH-005 | `[EC-WH-005] put while shares held` ✓ |
| R-LOTS | `SECOND_LOT_WITHOUT_CASH` | EC-WH-003 | `[EC-WH-003] second lot` ✓ |
| R-OTM | `OTM_OUTSIDE_ENVELOPE` | EC-EN-001 | `[EC-EN-001] Mentor band with 9.9% OTM` ✓ |
| R-DTE | `DTE_OUTSIDE_ENVELOPE` | EC-TM-001 | `[EC-TM-001] DTE on ET calendar` ✓ |
| R-CASH | `CASH_NOT_SECURED` | EC-CS-001 | `[EC-CS-001] cash short of reserve` ✓ |
| R-ACCT | `STALE_ACCOUNT_SNAPSHOT` | EC-CS-004 | `[EC-CS-004] snapshot older than 24 h` |
| R-FX | `FX_LOAN` | EC-CS-002 | `[EC-CS-002] HKD loan` ✓ |
| R-LEVEL | `LEVEL_GAP` | EC-DR-004 | `[EC-DR-004] Level 2 for a put` ✓ |
| R-PACKET | `PACKET_INCOMPLETE` | EC-PK-001 | `[EC-PK-001] no crash+MC` ✓ |
| R-BASIS | `LOCKED_LOSS_UNSIGNED` | EC-WH-004 | `[EC-WH-004] covered call under basis blocked…` ✓ |
| R-HALT | `HALT_ACTIVE` | EC-WH-006 | `[EC-WH-006] halt blocks any new cycle` ✓ (SQL) |
| R-MODE | `LIVE_NOT_ELIGIBLE` | EC-CP-003 | `[EC-CP-003] live without mastery` |
| R-ALLOW | `NOT_ALLOWLISTED` | EC-MD-005 | `[EC-MD-005] non-QQQ underlying` |
| R-EXDIV (warn) | `EXDIV_ASSIGNMENT_RISK` | EC-WH-008 | `[EC-WH-008] ex-div before expiry warns` |
| R-ITM (warn) | `CALL_ITM` | EC-WH-010 | `[EC-WH-010] ITM call warns` |

✓ = the test already exists in the spike (`docs/appendix`) and moves into the repo in F0.

## 5. Needs page → spec coverage

| Needs page | Primary spec docs | Gaps closed |
|------------|-------------------|-------------|
| 1 PRD | [01](01-product-spec.md), [15](15-implementation-plan.md) | G1–G17 ([01 §9](01-product-spec.md#9-gap-analysis-of-needs)) |
| 2 Architecture | [07](07-architecture.md), [17](17-adr.md) | Compose, job queue, no-submit layers |
| 3 E R model | [09](09-database.md), [appendix SQL](appendix/sql/001_init.sql) | derived vs stored, RLS, temporal envelope |
| 4 UX IA wireframes | [04](04-ux-ia-flows.md), [05](05-screens-wireframes.md), [06](06-ui-design-system.md) | 42 → 46 screens |
| 5 IB playbook | [05 §7](05-screens-wireframes.md), [02 §9](02-investment-domain.md#9-market-realities-the-code-must-respect) | fill recording, short-put life |
| 6 Learning & game | [03](03-serious-game-design.md) | evidence rules, paper lab |
| 7 AI agent | [11](11-agent-llm.md) | measured boundaries, citation guard |
| 8 Backtest & MC | [10](10-simulation-engines.md) | reproducibility, caps, BS proxy label |
| 9 Compliance | [12](12-compliance-copy.md) | explicit ack, copy lint |
| IMPL-READY | [15](15-implementation-plan.md) | epic order revised (E7a before E5/E6) |

---

## Cross-references

[01 Stories](01-product-spec.md#5-user-stories) · [05 Registry](05-screens-wireframes.md#1-screen-registry) · [07 API](07-architecture.md#6-api-surface) ·
[09 Tables](09-database.md#4-core-tables-by-module) · [13 Edge cases](13-edge-cases.md) · [14 Gate](14-test-strategy.md#6-traceability-gate-ci)
