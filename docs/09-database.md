# 09 · Database (Database Expert lens)

> PostgreSQL **18.6** + pgvector **0.8.6** (`pgvector/pgvector:0.8.6-pg18-trixie`). Baseline migration:
> [`appendix/sql/001_init.sql`](appendix/sql/001_init.sql). Behaviour proof: [`appendix/sql/verify_behaviour.sql`](appendix/sql/verify_behaviour.sql)
> (**31/31 PASS** as `edge_app` on 2026-09-23, plus a two-session race test). See [18 §3](18-references.md#3-verification-log).

---

## 1. WHY (database lens)

The database is the **last line of defence**. If every layer above it has a bug, it must still refuse a wrong-side draft, a second lot,
an illegal wheel transition, a quote from the future, an uncited rate, an edited audit row and a cross-user read. Constraints that
cannot be expressed in SQL live in `packages/domain`. Constraints that **can** are expressed in both places (defence in depth, FP-10).

## 2. Conventions

| Topic | Decision | Why |
|-------|----------|-----|
| Keys | `uuid DEFAULT uuidv7()` (PG18 built-in) | Time-ordered, good B-tree locality, no extension |
| Money | `NUMERIC(18,4)` USD | Exact; matches `Usd4` in TS ([02 §11](02-investment-domain.md#11-money-and-precision)) |
| Time | `timestamptz` (UTC); `date` for US/Eastern trade and expiry dates | Instants vs calendar days are different types |
| Closed sets | `ENUM` only when stable (`cycle_state`, `put_call`, …) | Changing enums needs a migration |
| Open sets | Reference tables (`skip_reason_code`, `halt_reason_code`, `audit_action`) | Add a row, not an `ALTER TYPE` |
| Deletion | Soft delete (`deleted_at`) for user content; **no delete** for audit/ledger/evidence/stress | Proof must survive |
| Naming | `snake_case`, singular tables, `_id` keys, `_at` instants, `_usd` money | Predictable SQL |
| Schema | Everything in `app`; the `edge_app` role owns nothing | Least privilege |

## 3. Derive, don't store

A stored fact that can be computed will eventually disagree with its source (Needs gap G4/G5).

| Needs field | Our approach | Where |
|-------------|--------------|-------|
| `packet_complete` | View `v_memo_packet` (crash ∧ mc links exist) | DDL §7 |
| `lots_open`, `reserved_usd` | View `v_wheel_summary` | DDL §8 |
| `leftover_usd`, `target_funded` | Domain function over latest snapshot + `v_wheel_summary` | `packages/domain/sizing.ts` |
| `WheelState.cost_basis` | Only on `share_lot.cost_basis` (written once at assignment) | DDL §8 |
| `phase` | `wheel_cycle.phase` GENERATED STORED from `state` | DDL §8 |
| `fx_loan_flag` | GENERATED VIRTUAL on `account_snapshot` | DDL §6 |
| `quiz passed` | GENERATED VIRTUAL `score ≥ threshold` | DDL §5 |
| `quarter_label`, `hk_year_of_assessment` | GENERATED VIRTUAL on `ledger_entry` | DDL §8 |
| QuarterlyLeg + TaxJournalRow | **One** `ledger_entry` + two views | §6 |

## 4. Core tables by module

### 4.1 Identity, envelope, learning

```
 ┌──────────────┐ 1   1 ┌──────────────┐      ┌──────────────────────┐
 │ app_user     │───────│ credential   │      │ envelope (seeded)    │
 │ user_id PK   │       │ argon2id hash│      │ beginner_v1          │
 │ email (uq)   │       └──────────────┘      │ mentor_cyrille_v1    │
 │ jurisdiction │ 1   * ┌──────────────┐      └──────────▲───────────┘
 │ account_mode │───────│ session      │                 │ FK
 └──────┬───────┘       │ token_sha256 │      ┌──────────┴───────────┐
        │               └──────────────┘      │ envelope_selection   │
        │ 1   *                               │ PK(user, valid_during│
        ├─────────────────────────────────────│   WITHOUT OVERLAPS)  │
        │                                     └──────────────────────┘
        │ 1   *  ┌──────────────────────┐  projection  ┌──────────────────────┐
        ├────────│ competency_evidence  │─────────────►│ mastery_progress     │
        │        │ append-only          │              │ CHECK all_passed ⇒ 6 │
        │        └──────────────────────┘              │ passed + paper wheel │
        │ 1   *  ┌──────────────────────┐              └──────────────────────┘
        ├────────│ quiz_attempt         │  passed VIRTUAL
        │        └──────────────────────┘
        │ 1   *  ┌──────────────────────┐
        └────────│ game_attempt         │  seed · mode · decisions JSONB (paper lab state)
                 └──────────────────────┘
```

### 4.2 Inputs, decide, stress

```
 ┌───────────────────┐   ┌───────────────────┐ 1  * ┌──────────────┐   ┌───────────────┐
 │ account_snapshot  │   │ market_snapshot   │──────│ option_quote │   │ rate_snapshot │
 │ fx_loan VIRTUAL   │   │ QQQ allowlist     │      │ bid ≤ ask    │   │ https source  │
 └─────────▲─────────┘   │ as_of ≤ now+5 min │      └──────▲───────┘   └──────▲────────┘
           │             └─────────▲─────────┘             │                  │
           │ pinned                │ pinned                │ FK               │ pinned
 ┌─────────┴───────────────────────┴───────────────────────┼──────────────────┴────────┐
 │ decision_memo  status building|decided · decision · precommit_plan (sell ⇒ ≥ 10 ch) │
 └──────┬──────────────────────┬──────────────────────────┬────────────────────────────┘
        │ 1  *                 │ 1  0..1                  │ 1  *  (kind: crash | mc | backtest)
 ┌──────┴───────────────┐ ┌────┴────────────┐    ┌────────┴─────────┐ *  1 ┌────────────────┐
 │ candidate            │ │ memo_skip       │    │ memo_stress      │──────│ stress_result  │
 │ five numbers stored  │ │ code FK · note  │    │ PK(memo, kind)   │      │ immutable      │
 │ rejected ⇒ unranked  │ │ other ⇒ note ≥3 │    │ replaceable link │      │ UQ inputs hash │
 └──────────────────────┘ └─────────────────┘    └──────────────────┘      └────────────────┘
```

Candidate invariants are stored because they are the **evidence of what the user saw** at decision time. They are recomputed by the domain on write, and a CHECK
re-asserts `worst_case = reserve − max_profit` for puts.

### 4.3 Execute, wheel, ledger

```
 ┌──────────────────────────┐ 1   * ┌───────────────────┐
 │ wheel_state (per user)   │───────│ wheel_cycle       │  state enum · phase STORED
 │ lots_max · halt_reason   │ lock  │ guard trigger:    │  ILLEGAL_TRANSITION
 │ serialisation point      │◄──────│ lots, halt        │  LOTS_EXCEEDED · HALT_ACTIVE
 └──────────────────────────┘       └──┬─────────┬──────┘
                                       │ 1  *    │ 1  0..1
 ┌───────────────────────────┐   ┌─────┴─────────┴───┐    ┌──────────────────────────┐
 │ draft_preview             │──►│ option_leg        │───►│ share_lot                │
 │ open⇒SELL · close⇒BUY     │   │ open_price = FILL │    │ qty % 100 = 0            │
 │ LMT only · blocked⇔reasons│   │ one open per cycle│    │ cost_basis (at assign)   │
 └───────────────────────────┘   └─────────┬─────────┘    └────────────┬─────────────┘
                                           │ *                         │ *
                                 ┌─────────┴───────────────────────────┴───────┐ 1  0..1 ┌────────────────┐
                                 │ ledger_entry  append-only · signed amounts  │─────────│ tax_annotation │
                                 │ quarter_label · hk_year_of_assessment VIRT. │         │ editable notes │
                                 └─────────────────────────────────────────────┘         └────────────────┘
```

### 4.4 Governance and agent

| Table | Purpose | Key constraints |
|-------|---------|-----------------|
| `audit_event` | Every state change and gate outcome | FK to `audit_action`; per-user `seq`; hash chain; no UPDATE/DELETE/TRUNCATE |
| `disclosure_ack` | Explicit ack per `copy_version` | PK (user, key, version) |
| `idempotency_key` | Replay protection | PK (user, key); 24 h expiry |
| `job` | Backtest/embed queue | `kind IN ('backtest','embed')`; `SKIP LOCKED` claim |
| `agent_message` | Transcript (90-day retention, OPEN-6) | `mode` enum; `policy_flags` |
| `rag_chunk` | Curriculum chunks | `vector(768)` HNSW + `tsvector` GIN; unique (slug, version, ordinal) |

## 5. Temporal envelope history (PG18)

```sql
-- one active period per user, enforced by the key itself (btree_gist)
PRIMARY KEY (user_id, valid_during WITHOUT OVERLAPS)

-- switch envelope atomically (use case SelectEnvelope)
UPDATE app.envelope_selection
   SET valid_during = tstzrange(lower(valid_during), now())
 WHERE user_id = app.current_user_id() AND upper_inf(valid_during);
INSERT INTO app.envelope_selection (user_id, envelope_id, valid_during, override_before_mastery)
VALUES (app.current_user_id(), 'mentor_cyrille_v1', tstzrange(now(), NULL), false);

-- which envelope applied at a past instant (reproducible packets, EC-EN-003)
SELECT envelope_id FROM app.envelope_selection
 WHERE user_id = app.current_user_id() AND valid_during @> timestamptz '2026-09-24 10:00+08';
```

Verified: an overlapping second period fails with `conflicting key value violates exclusion constraint` (EC-DB-002).

## 6. Ledger: one source, two views

```
 option fills, assignment, called away, fees, interest, dividends
                        │  (domain builds signed entries; CHECK enforces sign by kind)
                        ▼
              ┌───────────────────┐
              │   ledger_entry    │  append-only (trigger + REVOKE UPDATE)
              └────┬─────────┬────┘
                   │         │
   v_ledger_by_quarter     v_ledger_by_hk_yoa        both WITH (security_invoker = true)
   SCR-046 (calendar Q)    SCR-051 (1 Apr – 31 Mar)  + tax_annotation (editable notes, separate table)
```

Verified: 2026-03-31 → `2026-Q1`, YoA `2025/26`; 2026-04-01 → `2026-Q2`, YoA `2026/27` (EC-LG-003). Corrections are **reversing entries**, never
updates (EC-LG-002).

## 7. Audit trail: append-only and hash-chained

```
 app computes payload_hash = sha256(JCS(payload))          (RFC 8785 canonical JSON)
 trigger (BEFORE INSERT, per-user advisory lock):
    seq        = last.seq + 1
    prev_hash  = last.chain_hash
    chain_hash = sha256(prev_hash ‖ payload_hash ‖ utf8(action || '|' || seq))

  seq 1                 seq 2                 seq 3
 ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
 │ chain_hash h1│─────►│ prev = h1    │─────►│ prev = h2    │
 └──────────────┘      │ chain_hash h2│      │ chain_hash h3│
                       └──────────────┘      └──────────────┘
```

`GET /audit/verify` recomputes the chain in SQL (window over `seq`) and returns the first broken `seq`, if any (EC-DB-006). Tamper resistance
covers **application-level** actors. A superuser can still rewrite history, so hosted mode (OPEN-4) adds a periodic export of the latest
`chain_hash` to a separate store.

```sql
WITH c AS (
  SELECT seq, chain_hash,
         sha256(coalesce(lag(chain_hash) OVER w, '\x'::bytea) || payload_hash
                || convert_to(action || '|' || seq::text, 'UTF8')) AS expected
    FROM app.audit_event WHERE user_id = app.current_user_id() WINDOW w AS (ORDER BY seq))
SELECT min(seq) AS first_broken_seq FROM c WHERE chain_hash <> expected;
```

## 8. Roles and Row Level Security

```
 edge_owner (migrations; owns schema)       edge_app (runtime; LOGIN NOSUPERUSER NOBYPASSRLS)
   │                                          │  SELECT/INSERT/UPDATE on app.*  (UPDATE revoked on
   │                                          │  audit_event, ledger_entry, competency_evidence, stress_result)
   │                                          │  DELETE only on session, idempotency_key, memo_stress
   │                                          ▼
   │                           every transaction: set_config('app.user_id', <uuid>, true)
   │                                          │
   └─ SECURITY DEFINER (search_path pinned):   ▼
        auth_lookup(email) · session_resolve(sha256)      policies: user_id = current_user_id()
                                                          child tables: EXISTS(parent row visible)
                                                          views: WITH (security_invoker = true)
```

Verified: A sees only A; B sees 0 of A's audit/ledger/quotes/cycles **and views**; no `app.user_id` ⇒ 0 rows (fail closed); cross-user
insert fails `row-level security` (EC-SEC-001/002). A plain view (without `security_invoker`) **was shown to leak** A's memo to B.
Every view must therefore declare it (EC-DB-011, enforced by a catalogue test on `pg_class.reloptions`).

## 9. Constraint catalogue → edge cases

| Constraint | Guards against | EC | Verified |
|------------|----------------|----|----------|
| `draft_preview` CHECK open⇒SELL, close⇒BUY | Wrong-side ticket | EC-DR-001 | yes |
| `order_type = 'LMT'` | Market orders | EC-DR-002 | yes |
| `blocked ⇔ block_reasons ≠ {}` | Blocked without reason / reason without block | EC-DR-003 | yes |
| `wheel_cycle_guard` lots | Second lot (incl. concurrent race) | EC-WH-003 | yes (2 sessions) |
| `wheel_cycle_guard` halt | New cycle while halted | EC-WH-006 | yes |
| `allowed_transition` | Illegal wheel moves | EC-WH-005 | yes |
| One open leg per cycle (partial unique) | Two live legs in one cycle | EC-WH-001 | DDL |
| `share_lot.qty % 100 = 0` | Odd lots | EC-WH-009 | DDL |
| `decision_memo` sell ⇒ plan ≥ 10 (COALESCE) | Missing pre-commitment | EC-PK-004 | yes |
| `memo_skip` other ⇒ note ≥ 3 (COALESCE) | Empty "other" | EC-PK-006 | yes |
| `candidate` rejected ⇒ unranked; worst-case identity | Ranking a rejected strike | EC-PK-002 | DDL |
| `option_quote` bid ≤ ask | Crossed quotes | EC-MD-003 | yes |
| `market_snapshot` as_of ≤ created + 5 min; QQQ only | Future quotes, other tickers | EC-MD-005 | yes |
| `rate_snapshot.source_url ~ '^https://'` | Uncited rates | EC-MD-006 | yes |
| `ledger_entry` sign by kind | Sign errors | EC-LG-002 | yes |
| Append-only triggers + REVOKE | Tampering | EC-DB-003/005 | yes |
| `mastery_progress` all_passed CHECK | Early unlock | EC-LN-004 | yes |
| `stress_result` UNIQUE inputs; mc ⇒ seed | Duplicates, unreproducible MC | EC-DB-007 | yes |
| `credential` argon2id prefix | Weak hashes | EC-SEC-001 | DDL |

## 10. PG18 features used, and their pitfalls

| Feature | Use | Pitfall found while verifying | EC |
|---------|-----|-------------------------------|----|
| `uuidv7()` | All PKs | – | EC-DB-001 |
| VIRTUAL generated columns (default kind in 18) | `fx_loan_flag`, `passed`, quarter, YoA | Cannot use **user-defined types** (enums) ⇒ `phase` must be STORED. Cannot be indexed ⇒ `tsv` is STORED | EC-DB-009 |
| Temporal PK `WITHOUT OVERLAPS` | Envelope history | Needs `btree_gist` | EC-DB-002 |
| `RETURNING old.*, new.*` | Audit payloads for transitions | – | EC-DB-008 |
| Data volume layout | Compose volume at `/var/lib/postgresql` | PG18 images use `PGDATA=/var/lib/postgresql/18/docker`; mounting `/var/lib/postgresql/data` as in older guides breaks upgrades | EC-OPS-001 |
| SQL CHECK semantics | All nullable CHECKs | A CHECK that evaluates to NULL **passes** ⇒ wrap in `coalesce` | EC-DB-010 |
| Views + RLS | All views | Plain views bypass RLS ⇒ `security_invoker = true` | EC-DB-011 |

## 11. Indexes and query patterns

| Query | Index |
|-------|-------|
| Latest snapshot per user | `account_snapshot (user_id, as_of DESC)` |
| Memo history page | `decision_memo (user_id, decision_date DESC) WHERE deleted_at IS NULL` |
| Open cycles (chrome, guard) | `wheel_cycle (user_id) WHERE state <> 'closed'` |
| Ledger by date | `ledger_entry (user_id, trade_date)` |
| Audit page / verify | `UNIQUE (user_id, seq)` |
| Ready jobs | `job (run_after) WHERE status = 'queued'` |
| RAG hybrid | HNSW `vector_cosine_ops` + GIN `tsv` (fused with RRF in SQL, [11 §6](11-agent-llm.md#6-retrieval-rag)) |

## 12. Migrations

- Forward-only numbered SQL files in `db/migrations/` (`001_init.sql` = the appendix file). A ~60-line Bun migrator records `(version, sha256, applied_at)` in `app.schema_migration` and refuses to run if an applied file's checksum changed (EC-OPS-006).
- Expand → migrate → contract for any breaking change (add column nullable → backfill → add constraint `NOT VALID` → `VALIDATE`).
- The migrate container runs as `edge_owner`, then `ALTER ROLE edge_app PASSWORD` from env (never the `change-me` placeholder in any real environment).
- Boot check: API compares the domain `ENVELOPES` hash with `envelope.params_sha256` and refuses to start on mismatch (EC-EN-004).

## 13. Operations

| Task | Approach |
|------|----------|
| Backup | `pg_dump -Fc` nightly to a host folder (local mode); restore drill in E9 |
| Retention | Purge job: `idempotency_key` > 24 h, `session` expired > 7 d, `agent_message` > 90 d (audit keeps hashes) |
| Integration tests | One migrated **template DB**; each test file does `CREATE DATABASE t_x TEMPLATE edge_tpl` (fast, isolated) |
| Upgrades | Minor: image bump. Major: `pg_upgrade --link` using the PG18 volume layout |

---

## Cross-references

[02 Domain rules](02-investment-domain.md#8-draft-checklist-rules) · [07 Unit of work](07-architecture.md#73-unit-of-work-rls-context-and-audit-in-one-transaction) ·
[11 RAG](11-agent-llm.md#6-retrieval-rag) · [13 EC-DB](13-edge-cases.md#ec-db-database) · [14 Integration tests](14-test-strategy.md#4-integration-tests-real-postgres) · [18 Verification](18-references.md#3-verification-log)
