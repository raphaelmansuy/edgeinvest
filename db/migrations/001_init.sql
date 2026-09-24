-- 001_init.sql — EdgeInvest (CSP / QQQ wheel) baseline schema
-- Target: PostgreSQL 18.6 + pgvector 0.8.6 (image pgvector/pgvector:0.8.6-pg18-trixie)
-- Spec: docs/09-database.md · Edge cases: docs/13-edge-cases.md (EC-DB-*)
-- Conventions: UUIDv7 PKs (PG18 uuidv7()), money NUMERIC(18,4) USD, TIMESTAMPTZ in UTC,
--              append-only for audit/ledger/evidence, RLS on every user-owned table.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector: RAG embeddings
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- temporal PK (WITHOUT OVERLAPS) on uuid + range

CREATE SCHEMA IF NOT EXISTS app;
SET search_path = app, public;

-- ---------------------------------------------------------------------------
-- 1. Stable enums (closed sets that change only with a product decision)
-- ---------------------------------------------------------------------------
CREATE TYPE account_mode      AS ENUM ('paper', 'live');
CREATE TYPE put_call          AS ENUM ('P', 'C');
CREATE TYPE cycle_state       AS ENUM ('short_put_open', 'shares_held', 'shares_short_call', 'closed');
CREATE TYPE competency_status AS ENUM ('locked', 'in_progress', 'passed');
CREATE TYPE competency        AS ENUM ('vocabulary', 'arithmetic', 'risk', 'cash_discipline',
                                       'strike_selection', 'management');
CREATE TYPE decision_type     AS ENUM ('sell', 'skip', 'wait', 'close', 'roll', 'cover_call');
CREATE TYPE stress_kind       AS ENUM ('crash', 'mc', 'backtest');
CREATE TYPE claim_label       AS ENUM ('illustrative_meeting', 'sourced_sim', 'unconfirmed');
CREATE TYPE draft_status      AS ENUM ('open', 'approved', 'discarded', 'blocked', 'submitted_by_user');
CREATE TYPE actor_kind        AS ENUM ('user', 'agent', 'system');

-- ---------------------------------------------------------------------------
-- 2. Reference tables (evolving catalogs: add a row, not an ALTER TYPE)
-- ---------------------------------------------------------------------------
CREATE TABLE skip_reason_code (code TEXT PRIMARY KEY, sort_order INT NOT NULL);
INSERT INTO skip_reason_code VALUES
  ('premium_below_tbill',1),('otm_outside_envelope',2),('fx_imbalance',3),('concentration',4),
  ('crash_uncomfortable',5),('no_level3',6),('personal_discretion',7),('other',8);

CREATE TABLE halt_reason_code (code TEXT PRIMARY KEY, blocks_all_drafts BOOLEAN NOT NULL DEFAULT true);
INSERT INTO halt_reason_code (code) VALUES
  ('second_lot_without_cash'),('fx_loan'),('locked_loss_unsigned'),('willingness_declined'),
  ('packet_incomplete'),('empty_chain'),('level_gap'),('paper_bar_missing');

CREATE TABLE audit_action (action TEXT PRIMARY KEY);
INSERT INTO audit_action VALUES
  ('disclosure_viewed'),('disclosure_acked'),('envelope_changed'),('envelope_override_before_mastery'),
  ('mastery_unlocked'),('mode_changed'),('packet_completed'),('skip_recorded'),
  ('draft_preview_created'),('draft_blocked'),('draft_submitted_by_user'),('agent_refuse_advice'),
  ('hk_export'),('live_submit_attempt_blocked'),('assignment_confirmed'),('locked_loss_accepted'),
  ('halt_raised'),('halt_cleared'),('phase_changed'),('fill_cash_enabled'),('fill_recorded'),
  ('session_started'),('session_revoked');

-- Legal wheel transitions. The domain state machine is the primary guard;
-- this table + trigger is defense in depth (EC-DB-004).
CREATE TABLE allowed_transition (
  from_state cycle_state NOT NULL,
  to_state   cycle_state NOT NULL,
  PRIMARY KEY (from_state, to_state)
);
INSERT INTO allowed_transition VALUES
  ('short_put_open','short_put_open'),     -- roll (new leg, same cycle)
  ('short_put_open','closed'),             -- expired worthless / bought back
  ('short_put_open','shares_held'),        -- assigned (incl. early assignment)
  ('shares_held','shares_short_call'),     -- covered call filled
  ('shares_held','closed'),                -- shares sold manually
  ('shares_short_call','shares_held'),     -- call expired / bought back
  ('shares_short_call','shares_short_call'),-- call roll
  ('shares_short_call','closed');          -- called away

-- ---------------------------------------------------------------------------
-- 3. Identity
-- ---------------------------------------------------------------------------
CREATE TABLE app_user (
  user_id       UUID PRIMARY KEY DEFAULT uuidv7(),
  email         TEXT NOT NULL,
  display_name  TEXT,
  locale        TEXT NOT NULL DEFAULT 'en',
  jurisdiction  CHAR(2) NOT NULL DEFAULT 'HK' CHECK (jurisdiction ~ '^[A-Z]{2}$'),
  voice_profile TEXT NOT NULL DEFAULT 'personal_book',
  account_mode  account_mode NOT NULL DEFAULT 'paper',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX app_user_email_uq ON app_user (lower(email)) WHERE deleted_at IS NULL;

CREATE TABLE credential (
  user_id       UUID PRIMARY KEY REFERENCES app_user,
  password_hash TEXT NOT NULL CHECK (password_hash LIKE '$argon2id$%'),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE session (
  token_sha256 BYTEA PRIMARY KEY CHECK (octet_length(token_sha256) = 32),  -- raw token never stored
  user_id      UUID NOT NULL REFERENCES app_user,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ,
  CHECK (expires_at > created_at)
);
CREATE INDEX session_user_idx ON session (user_id) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Envelope (config-as-code, mirrored here for FK integrity; boot asserts params_sha256)
-- ---------------------------------------------------------------------------
CREATE TABLE envelope (
  envelope_id      TEXT PRIMARY KEY,
  version          INT  NOT NULL,
  otm_min          NUMERIC(8,6) NOT NULL,
  otm_max          NUMERIC(8,6) NOT NULL,
  dte_min          INT NOT NULL,
  dte_max          INT NOT NULL,
  requires_mastery BOOLEAN NOT NULL,
  params           JSONB NOT NULL,
  params_sha256    TEXT NOT NULL,
  CHECK (0 < otm_min AND otm_min < otm_max AND otm_max < 1),
  CHECK (0 < dte_min AND dte_min <= dte_max)
);
INSERT INTO envelope VALUES
  ('beginner_v1',       1, 0.05, 0.12, 60, 120, false, '{"lots_max":1,"order_type":"LMT"}', 'seed'),
  ('mentor_cyrille_v1', 1, 0.16, 0.30, 60, 120, true,  '{"lots_max":1,"order_type":"LMT"}', 'seed');

-- History of the active envelope per user; PG18 temporal PK forbids overlapping periods.
CREATE TABLE envelope_selection (
  user_id                 UUID NOT NULL REFERENCES app_user,
  envelope_id             TEXT NOT NULL REFERENCES envelope,
  valid_during            TSTZRANGE NOT NULL,
  override_before_mastery BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, valid_during WITHOUT OVERLAPS)
);

-- ---------------------------------------------------------------------------
-- 5. Learning & mastery
-- ---------------------------------------------------------------------------
CREATE TABLE competency_evidence (             -- append-only; mastery_progress is its projection
  evidence_id UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id     UUID NOT NULL REFERENCES app_user,
  competency  competency NOT NULL,
  rule_id     TEXT NOT NULL,                   -- e.g. 'arith.three_tickets', see docs/03
  source_ref  TEXT NOT NULL,                   -- attempt/quiz id
  passed      BOOLEAN NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX competency_evidence_user_idx ON competency_evidence (user_id, competency, created_at DESC);

CREATE TABLE mastery_progress (
  user_id                  UUID PRIMARY KEY REFERENCES app_user,
  vocabulary               competency_status NOT NULL DEFAULT 'locked',
  arithmetic               competency_status NOT NULL DEFAULT 'locked',
  risk                     competency_status NOT NULL DEFAULT 'locked',
  cash_discipline          competency_status NOT NULL DEFAULT 'locked',
  strike_selection         competency_status NOT NULL DEFAULT 'locked',
  management               competency_status NOT NULL DEFAULT 'locked',
  paper_wheel_completed_at TIMESTAMPTZ,
  all_passed_at            TIMESTAMPTZ,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- all_passed_at can only be set when all six passed AND the paper wheel (incl. SCR-012) is done
  CHECK (all_passed_at IS NULL OR (
    vocabulary='passed' AND arithmetic='passed' AND risk='passed' AND cash_discipline='passed'
    AND strike_selection='passed' AND management='passed' AND paper_wheel_completed_at IS NOT NULL))
);

CREATE TABLE quiz_attempt (
  attempt_id         UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id            UUID NOT NULL REFERENCES app_user,
  module_code        TEXT NOT NULL CHECK (module_code ~ '^M[0-9]$'),
  content_version    INT NOT NULL,
  score_pct          NUMERIC(5,2) NOT NULL CHECK (score_pct BETWEEN 0 AND 100),
  pass_threshold_pct NUMERIC(5,2) NOT NULL DEFAULT 80,
  passed             BOOLEAN GENERATED ALWAYS AS (score_pct >= pass_threshold_pct) VIRTUAL,  -- PG18
  answers            JSONB NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE game_attempt (
  attempt_id       UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id          UUID NOT NULL REFERENCES app_user,
  scenario_id      TEXT NOT NULL,
  scenario_version INT NOT NULL,
  mode             TEXT NOT NULL CHECK (mode IN ('tutorial','scenario','crash','committee','post_assign','paper_lab')),
  seed             BIGINT NOT NULL,
  graded           BOOLEAN NOT NULL,
  decisions        JSONB NOT NULL DEFAULT '[]',
  rubric           JSONB,
  process_score    NUMERIC(5,2) CHECK (process_score BETWEEN 0 AND 100),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 6. Market & account inputs (user-captured in MVP; never invented — EC-MD-*)
-- ---------------------------------------------------------------------------
CREATE TABLE account_snapshot (
  snapshot_id      UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id          UUID NOT NULL REFERENCES app_user,
  mode             account_mode NOT NULL,
  as_of            TIMESTAMPTZ NOT NULL,
  nlv_usd          NUMERIC(18,4),
  usd_settled_cash NUMERIC(18,4) NOT NULL,
  hkd_cash         NUMERIC(18,4) NOT NULL DEFAULT 0,
  fx_loan_flag     BOOLEAN GENERATED ALWAYS AS (usd_settled_cash < 0 OR hkd_cash < 0) VIRTUAL,
  options_level    SMALLINT CHECK (options_level BETWEEN 0 AND 4),
  source           TEXT NOT NULL CHECK (source IN ('manual','broker_sync')),  -- paper lab never writes real rows (ADR-014)
  raw              JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX account_snapshot_user_idx ON account_snapshot (user_id, as_of DESC);

CREATE TABLE market_snapshot (
  market_snapshot_id UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id            UUID NOT NULL REFERENCES app_user,
  underlying         TEXT NOT NULL DEFAULT 'QQQ' CHECK (underlying IN ('QQQ')),   -- allowlist
  spot               NUMERIC(18,4) NOT NULL CHECK (spot > 0),
  as_of              TIMESTAMPTZ NOT NULL,
  source             TEXT NOT NULL CHECK (source IN ('manual','fixture','broker_sync')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (as_of <= created_at + interval '5 minutes')                              -- no future quotes
);

CREATE TABLE option_quote (
  quote_id           UUID PRIMARY KEY DEFAULT uuidv7(),
  market_snapshot_id UUID NOT NULL REFERENCES market_snapshot,
  put_call           put_call NOT NULL,
  expiry             DATE NOT NULL,
  strike             NUMERIC(18,4) NOT NULL CHECK (strike > 0),
  bid                NUMERIC(18,4) CHECK (bid >= 0),
  ask                NUMERIC(18,4) CHECK (ask > 0),
  CHECK (bid IS NULL OR ask IS NULL OR bid <= ask),                              -- no crossed quote
  UNIQUE (market_snapshot_id, put_call, expiry, strike)
);

CREATE TABLE rate_snapshot (
  rate_id    UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id    UUID NOT NULL REFERENCES app_user,
  kind       TEXT NOT NULL CHECK (kind IN ('tbill_4w','tbill_13w','idle_cash','sgov_sec')),
  rate       NUMERIC(8,6) NOT NULL CHECK (rate > -0.05 AND rate < 0.25),          -- annual, decimal
  as_of      DATE NOT NULL,
  source_url TEXT NOT NULL CHECK (source_url ~ '^https://'),                     -- cite-or-refuse
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 7. Decide: memo, candidates, skip, stress
-- ---------------------------------------------------------------------------
CREATE TABLE decision_memo (
  memo_id             UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id             UUID NOT NULL REFERENCES app_user,
  decision_date       DATE NOT NULL,
  phase               TEXT NOT NULL CHECK (phase IN ('cash-put','shares-held')),
  envelope_id         TEXT NOT NULL REFERENCES envelope,
  account_snapshot_id UUID REFERENCES account_snapshot,
  market_snapshot_id  UUID REFERENCES market_snapshot,
  rate_id             UUID REFERENCES rate_snapshot,
  status              TEXT NOT NULL DEFAULT 'building' CHECK (status IN ('building','decided')),
  decision            decision_type,
  precommit_plan      TEXT,                     -- "If QQQ −20% in week two, I will …"
  rationale           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at          TIMESTAMPTZ,
  deleted_at          TIMESTAMPTZ,
  CHECK ((status = 'decided') = (decision IS NOT NULL AND decided_at IS NOT NULL)),
  -- COALESCE: a CHECK that evaluates to NULL *passes* in SQL (EC-DB-010)
  CHECK (decision IS DISTINCT FROM 'sell' OR coalesce(length(trim(precommit_plan)), 0) >= 10)
);
CREATE INDEX decision_memo_user_idx ON decision_memo (user_id, decision_date DESC) WHERE deleted_at IS NULL;

CREATE TABLE candidate (
  candidate_id      UUID PRIMARY KEY DEFAULT uuidv7(),
  memo_id           UUID NOT NULL REFERENCES decision_memo,
  quote_id          UUID NOT NULL REFERENCES option_quote,
  put_call          put_call NOT NULL,
  strike            NUMERIC(18,4) NOT NULL,
  expiry            DATE NOT NULL,
  dte               INT NOT NULL CHECK (dte >= 0),
  otm_pct           NUMERIC(8,6) NOT NULL,
  limit_price       NUMERIC(18,4) NOT NULL CHECK (limit_price > 0),
  reserve_usd       NUMERIC(18,4) NOT NULL,
  max_profit_usd    NUMERIC(18,4) NOT NULL,
  break_even        NUMERIC(18,4) NOT NULL,
  worst_case_usd    NUMERIC(18,4) NOT NULL,
  premium_yield_ann NUMERIC(10,6),
  score             NUMERIC(12,6),
  rank              INT CHECK (rank >= 1),
  reject_reasons    TEXT[] NOT NULL DEFAULT '{}',
  CHECK (rank IS NULL OR cardinality(reject_reasons) = 0),      -- rejected ⇒ never ranked
  CHECK (worst_case_usd = reserve_usd - max_profit_usd OR put_call = 'C')
);

CREATE TABLE memo_skip (
  memo_id    UUID PRIMARY KEY REFERENCES decision_memo,
  code       TEXT NOT NULL REFERENCES skip_reason_code,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (code <> 'other' OR coalesce(length(trim(note)), 0) >= 3)
);

CREATE TABLE stress_result (                       -- immutable; dedup on identical inputs
  result_id     UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id       UUID NOT NULL REFERENCES app_user,
  kind          stress_kind NOT NULL,
  model_version TEXT NOT NULL,
  seed          BIGINT,
  input_hash    TEXT NOT NULL CHECK (input_hash ~ '^sha256:[0-9a-f]{64}$'),
  params        JSONB NOT NULL,
  summary       JSONB NOT NULL,
  claim_label   claim_label NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, model_version, input_hash),
  CHECK (kind <> 'mc' OR seed IS NOT NULL)
);

CREATE TABLE memo_stress (                         -- replaceable link until memo is frozen
  memo_id     UUID NOT NULL REFERENCES decision_memo,
  kind        stress_kind NOT NULL,
  result_id   UUID NOT NULL REFERENCES stress_result,
  attached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (memo_id, kind)
);

-- Packet completeness is DERIVED, never stored (no drift). US-3 / EC-PK-001.
-- security_invoker: a plain view runs with its OWNER's rights and would bypass RLS (EC-DB-011).
CREATE VIEW v_memo_packet WITH (security_invoker = true) AS
SELECT m.memo_id, m.user_id,
       EXISTS (SELECT 1 FROM memo_stress s WHERE s.memo_id = m.memo_id AND s.kind = 'crash') AS has_crash,
       EXISTS (SELECT 1 FROM memo_stress s WHERE s.memo_id = m.memo_id AND s.kind = 'mc')    AS has_mc,
       EXISTS (SELECT 1 FROM memo_stress s WHERE s.memo_id = m.memo_id AND s.kind = 'crash')
   AND EXISTS (SELECT 1 FROM memo_stress s WHERE s.memo_id = m.memo_id AND s.kind = 'mc')    AS packet_complete
FROM decision_memo m;

-- ---------------------------------------------------------------------------
-- 8. Execute: drafts (never sent), wheel cycles, legs, lots
-- ---------------------------------------------------------------------------
CREATE TABLE draft_preview (
  draft_id      UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id       UUID NOT NULL REFERENCES app_user,
  memo_id       UUID REFERENCES decision_memo,
  candidate_id  UUID REFERENCES candidate,
  cycle_id      UUID,                                 -- set for closing / covered-call drafts
  account_mode  account_mode NOT NULL,
  side          TEXT NOT NULL CHECK (side IN ('SELL','BUY')),
  open_close    TEXT NOT NULL CHECK (open_close IN ('open','close')),
  put_call      put_call NOT NULL,
  qty           INT NOT NULL CHECK (qty > 0),
  strike        NUMERIC(18,4) NOT NULL CHECK (strike > 0),
  expiry        DATE NOT NULL,
  limit_price   NUMERIC(18,4) NOT NULL CHECK (limit_price > 0),
  order_type    TEXT NOT NULL DEFAULT 'LMT' CHECK (order_type = 'LMT'),     -- LIMIT_ONLY
  tif           TEXT NOT NULL DEFAULT 'DAY' CHECK (tif IN ('DAY','GTC')),
  status        draft_status NOT NULL DEFAULT 'open',
  checklist     JSONB NOT NULL,                       -- rule results, see docs/02 §8
  block_reasons TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  CHECK ((status = 'blocked') = (cardinality(block_reasons) > 0)),
  CHECK ((open_close = 'open' AND side = 'SELL') OR (open_close = 'close' AND side = 'BUY'))  -- wrong-side guard
);

CREATE TABLE wheel_state (                          -- per-user aggregate + serialization point
  user_id         UUID PRIMARY KEY REFERENCES app_user,
  lots_max        INT NOT NULL DEFAULT 1 CHECK (lots_max BETWEEN 1 AND 10),
  willingness_cap INT NOT NULL DEFAULT 1 CHECK (willingness_cap >= 0),
  halt_reason     TEXT REFERENCES halt_reason_code,
  halted_at       TIMESTAMPTZ,
  version         BIGINT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((halt_reason IS NULL) = (halted_at IS NULL))
);

CREATE TABLE wheel_cycle (                          -- one "lot" = one 100-share commitment
  cycle_id   UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id    UUID NOT NULL REFERENCES app_user,
  mode       account_mode NOT NULL,
  state      cycle_state NOT NULL DEFAULT 'short_put_open',
  phase      TEXT GENERATED ALWAYS AS (
               CASE WHEN state IN ('shares_held','shares_short_call') THEN 'shares-held'
                    ELSE 'cash-put' END) STORED,  -- PG18: VIRTUAL cannot use enum types (EC-DB-009)
  opened_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at  TIMESTAMPTZ,
  CHECK ((state = 'closed') = (closed_at IS NOT NULL))
);
CREATE INDEX wheel_cycle_open_idx ON wheel_cycle (user_id) WHERE state <> 'closed';
ALTER TABLE draft_preview ADD FOREIGN KEY (cycle_id) REFERENCES wheel_cycle;

CREATE TABLE option_leg (
  leg_id       UUID PRIMARY KEY DEFAULT uuidv7(),
  cycle_id     UUID NOT NULL REFERENCES wheel_cycle,
  draft_id     UUID REFERENCES draft_preview,
  put_call     put_call NOT NULL,
  strike       NUMERIC(18,4) NOT NULL CHECK (strike > 0),
  expiry       DATE NOT NULL,
  qty          INT NOT NULL CHECK (qty > 0),
  open_price   NUMERIC(18,4) NOT NULL CHECK (open_price > 0),   -- ACTUAL fill, not draft limit
  opened_at    TIMESTAMPTZ NOT NULL,
  close_price  NUMERIC(18,4) CHECK (close_price >= 0),
  closed_at    TIMESTAMPTZ,
  close_reason TEXT CHECK (close_reason IN ('expired','bought_back','assigned','called_away','rolled')),
  CHECK ((closed_at IS NULL) = (close_reason IS NULL)),
  CHECK (closed_at IS NULL OR closed_at >= opened_at)
);
CREATE UNIQUE INDEX option_leg_one_open_per_cycle ON option_leg (cycle_id) WHERE closed_at IS NULL;

CREATE TABLE share_lot (
  lot_id               UUID PRIMARY KEY DEFAULT uuidv7(),
  cycle_id             UUID NOT NULL UNIQUE REFERENCES wheel_cycle,
  symbol               TEXT NOT NULL DEFAULT 'QQQ',
  qty                  INT NOT NULL CHECK (qty > 0 AND qty % 100 = 0),
  cost_basis           NUMERIC(18,4) NOT NULL CHECK (cost_basis > 0),  -- put_strike − put_fill_premium
  assigned_from_leg_id UUID NOT NULL REFERENCES option_leg,
  opened_at            TIMESTAMPTZ NOT NULL,
  closed_at            TIMESTAMPTZ,
  close_reason         TEXT CHECK (close_reason IN ('called_away','sold_manual')),
  CHECK ((closed_at IS NULL) = (close_reason IS NULL))
);

-- Cash-flow ledger: append-only single source for Quarterly ledger (SCR-046) and HK tax journal (SCR-051).
CREATE TABLE ledger_entry (
  entry_id       UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id        UUID NOT NULL REFERENCES app_user,
  mode           account_mode NOT NULL,
  cycle_id       UUID REFERENCES wheel_cycle,
  leg_id         UUID REFERENCES option_leg,
  lot_id         UUID REFERENCES share_lot,
  kind           TEXT NOT NULL CHECK (kind IN ('put_premium','call_premium','buy_to_close',
                   'assignment_purchase','called_away_sale','share_sale','fee','interest','dividend')),
  amount_usd     NUMERIC(18,4) NOT NULL,             -- signed: credit > 0, debit < 0
  trade_date     DATE NOT NULL,                      -- US/Eastern trade date
  quarter_label  TEXT GENERATED ALWAYS AS (
                   extract(year FROM trade_date)::int::text || '-Q' || extract(quarter FROM trade_date)::int::text
                 ) VIRTUAL,
  hk_year_of_assessment TEXT GENERATED ALWAYS AS (   -- HK YoA runs 1 Apr – 31 Mar, e.g. '2026/27'
                   CASE WHEN extract(month FROM trade_date) >= 4
                        THEN extract(year FROM trade_date)::int::text || '/' ||
                             lpad(((extract(year FROM trade_date)::int + 1) % 100)::text, 2, '0')
                        ELSE (extract(year FROM trade_date)::int - 1)::text || '/' ||
                             lpad((extract(year FROM trade_date)::int % 100)::text, 2, '0')
                   END) VIRTUAL,
  source         TEXT NOT NULL CHECK (source IN ('manual','broker_sync')),  -- paper lab never writes here (ADR-014, EC-LN-007)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((kind IN ('put_premium','call_premium','called_away_sale','share_sale','interest','dividend') AND amount_usd > 0)
      OR (kind IN ('buy_to_close','assignment_purchase','fee') AND amount_usd < 0))
);
CREATE INDEX ledger_entry_user_idx ON ledger_entry (user_id, trade_date);

CREATE TABLE tax_annotation (                        -- user-editable notes; ledger itself stays immutable
  entry_id             UUID PRIMARY KEY REFERENCES ledger_entry,
  hk_note              TEXT,
  badges_of_trade_flag BOOLEAN NOT NULL DEFAULT false,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Two views over ONE ledger (SCR-046 quarterly, SCR-051 HK year of assessment). All views are security_invoker.
CREATE VIEW v_ledger_by_quarter WITH (security_invoker = true) AS
SELECT user_id, mode, quarter_label, kind, count(*) AS rows, sum(amount_usd) AS amount_usd
  FROM ledger_entry GROUP BY user_id, mode, quarter_label, kind;

CREATE VIEW v_ledger_by_hk_yoa WITH (security_invoker = true) AS
SELECT user_id, mode, hk_year_of_assessment, kind, count(*) AS rows, sum(amount_usd) AS amount_usd
  FROM ledger_entry GROUP BY user_id, mode, hk_year_of_assessment, kind;

-- Chrome numbers (SCR-000): lots open and cash reserved by open short puts are DERIVED (G4).
CREATE VIEW v_wheel_summary WITH (security_invoker = true) AS
SELECT ws.user_id, ws.lots_max, ws.halt_reason,
       (SELECT count(*) FROM wheel_cycle c WHERE c.user_id = ws.user_id AND c.state <> 'closed') AS lots_open,
       (SELECT coalesce(sum(l.strike * 100 * l.qty), 0)
          FROM wheel_cycle c JOIN option_leg l ON l.cycle_id = c.cycle_id
         WHERE c.user_id = ws.user_id AND c.state = 'short_put_open'
           AND l.put_call = 'P' AND l.closed_at IS NULL)                             AS reserved_usd
  FROM wheel_state ws;

-- ---------------------------------------------------------------------------
-- 9. Governance: audit (hash-chained, append-only), disclosures, idempotency, jobs
-- ---------------------------------------------------------------------------
CREATE TABLE audit_event (
  event_id     UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id      UUID NOT NULL REFERENCES app_user,
  seq          BIGINT NOT NULL,
  actor        actor_kind NOT NULL,
  action       TEXT NOT NULL REFERENCES audit_action,
  scr_id       TEXT CHECK (scr_id ~ '^SCR-[0-9]{3}$'),
  payload      JSONB NOT NULL,
  payload_hash BYTEA NOT NULL CHECK (octet_length(payload_hash) = 32),  -- sha256(JCS(payload)) from app
  prev_hash    BYTEA,
  chain_hash   BYTEA NOT NULL,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, seq)
);
CREATE INDEX audit_event_action_idx ON audit_event (action, ts DESC);

CREATE FUNCTION audit_event_chain() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE last RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 42));   -- serialize per user
  SELECT seq, chain_hash INTO last FROM app.audit_event
   WHERE user_id = NEW.user_id ORDER BY seq DESC LIMIT 1;
  NEW.seq        := COALESCE(last.seq, 0) + 1;
  NEW.prev_hash  := last.chain_hash;
  NEW.chain_hash := sha256(COALESCE(last.chain_hash, '\x'::bytea) || NEW.payload_hash
                           || convert_to(NEW.action || '|' || NEW.seq::text, 'UTF8'));
  RETURN NEW;
END $$;
CREATE TRIGGER audit_event_chain_trg BEFORE INSERT ON audit_event
  FOR EACH ROW EXECUTE FUNCTION audit_event_chain();

CREATE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY: % on % is forbidden', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END $$;
CREATE TRIGGER audit_event_no_update BEFORE UPDATE OR DELETE ON audit_event
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER audit_event_no_truncate BEFORE TRUNCATE ON audit_event
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER ledger_entry_no_update BEFORE UPDATE OR DELETE ON ledger_entry
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER evidence_no_update BEFORE UPDATE OR DELETE ON competency_evidence
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER stress_result_no_update BEFORE UPDATE OR DELETE ON stress_result
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TABLE disclosure_ack (
  user_id        UUID NOT NULL REFERENCES app_user,
  disclosure_key TEXT NOT NULL,
  copy_version   TEXT NOT NULL,
  scr_id         TEXT NOT NULL,
  acked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, disclosure_key, copy_version)
);

CREATE TABLE idempotency_key (
  user_id      UUID NOT NULL REFERENCES app_user,
  key          TEXT NOT NULL CHECK (length(key) BETWEEN 8 AND 128),
  request_hash BYTEA NOT NULL,
  status_code  INT,
  response     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',
  PRIMARY KEY (user_id, key)
);

CREATE TABLE job (
  job_id       UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id      UUID NOT NULL REFERENCES app_user,
  kind         TEXT NOT NULL CHECK (kind IN ('backtest','embed')),   -- mc/crash run inline (docs/10 §6)
  payload      JSONB NOT NULL,
  status       TEXT NOT NULL DEFAULT 'queued'
               CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  attempts     INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  run_after    TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by    TEXT,
  locked_at    TIMESTAMPTZ,
  result_id    UUID REFERENCES stress_result,
  error        JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (attempts <= max_attempts),
  CHECK (status <> 'succeeded' OR result_id IS NOT NULL OR kind = 'embed')
);
CREATE INDEX job_ready_idx ON job (run_after) WHERE status = 'queued';

-- ---------------------------------------------------------------------------
-- 10. Agent & RAG
-- ---------------------------------------------------------------------------
CREATE TABLE agent_message (
  message_id      UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id         UUID NOT NULL REFERENCES app_user,
  conversation_id UUID NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','tool','system')),
  mode            TEXT NOT NULL CHECK (mode IN ('ask','ticket','packet','drill')),
  content         TEXT NOT NULL,
  tool_calls      JSONB,
  tool_name       TEXT,
  model           TEXT,
  prompt_version  TEXT,
  policy_flags    TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX agent_message_conv_idx ON agent_message (conversation_id, created_at);

CREATE TABLE rag_chunk (
  chunk_id        UUID PRIMARY KEY DEFAULT uuidv7(),
  source_slug     TEXT NOT NULL,
  source_url      TEXT NOT NULL,
  content_version INT NOT NULL,
  ordinal         INT NOT NULL,
  claim_tag       claim_label,
  content         TEXT NOT NULL,
  tsv             TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED, -- indexable ⇒ STORED
  embed_model     TEXT NOT NULL,
  embedding       VECTOR(768) NOT NULL,
  UNIQUE (source_slug, content_version, ordinal)
);
CREATE INDEX rag_chunk_hnsw ON rag_chunk USING hnsw (embedding vector_cosine_ops);
CREATE INDEX rag_chunk_tsv  ON rag_chunk USING gin (tsv);

-- ---------------------------------------------------------------------------
-- 11. Wheel integrity triggers (defense in depth behind the domain layer)
-- ---------------------------------------------------------------------------
CREATE FUNCTION wheel_cycle_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ws RECORD; open_count INT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.state IS DISTINCT FROM OLD.state THEN
    IF NOT EXISTS (SELECT 1 FROM app.allowed_transition
                    WHERE from_state = OLD.state AND to_state = NEW.state) THEN
      RAISE EXCEPTION 'ILLEGAL_TRANSITION: % -> %', OLD.state, NEW.state USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO ws FROM app.wheel_state WHERE user_id = NEW.user_id FOR UPDATE;  -- serialization point
    IF NOT FOUND THEN
      RAISE EXCEPTION 'WHEEL_STATE_MISSING' USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF ws.halt_reason IS NOT NULL THEN
      RAISE EXCEPTION 'HALT_ACTIVE: %', ws.halt_reason USING ERRCODE = 'check_violation';
    END IF;
    SELECT count(*) INTO open_count FROM app.wheel_cycle
     WHERE user_id = NEW.user_id AND state <> 'closed' AND cycle_id <> NEW.cycle_id;
    IF open_count + 1 > ws.lots_max THEN
      RAISE EXCEPTION 'LOTS_EXCEEDED: open=% max=%', open_count, ws.lots_max USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER wheel_cycle_guard_trg BEFORE INSERT OR UPDATE OF state ON wheel_cycle
  FOR EACH ROW EXECUTE FUNCTION wheel_cycle_guard();

-- ---------------------------------------------------------------------------
-- 12. Least-privilege app role + Row Level Security
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'edge_app') THEN
    CREATE ROLE edge_app LOGIN PASSWORD 'change-me' NOSUPERUSER NOBYPASSRLS;   -- password rotated by ops
  END IF;
END $$;
GRANT USAGE ON SCHEMA app TO edge_app;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO edge_app;
GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA app TO edge_app;
REVOKE UPDATE ON audit_event, ledger_entry, competency_evidence, stress_result FROM edge_app;
GRANT DELETE ON session, idempotency_key, memo_stress TO edge_app;   -- the only hard deletes allowed

-- current_setting('app.user_id', true) is set per transaction with set_config(..., true).
CREATE FUNCTION current_user_id() RETURNS UUID LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['credential','session','envelope_selection','competency_evidence',
    'mastery_progress','quiz_attempt','game_attempt','account_snapshot','market_snapshot','rate_snapshot',
    'decision_memo','stress_result','draft_preview','wheel_state','wheel_cycle','ledger_entry',
    'audit_event','disclosure_ack','idempotency_key','job','agent_message']
  LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON app.%I USING (user_id = app.current_user_id())
                    WITH CHECK (user_id = app.current_user_id())', t || '_owner', t);
  END LOOP;
END $$;
-- app_user itself: a user sees only their row
ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_user_self ON app_user USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());

-- Child tables inherit ownership through their parent (no duplicated user_id column).
ALTER TABLE candidate      ENABLE ROW LEVEL SECURITY;
ALTER TABLE memo_skip      ENABLE ROW LEVEL SECURITY;
ALTER TABLE memo_stress    ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_quote   ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_leg     ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_lot      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_annotation ENABLE ROW LEVEL SECURITY;
CREATE POLICY candidate_owner   ON candidate   USING (EXISTS (SELECT 1 FROM decision_memo m WHERE m.memo_id = candidate.memo_id));
CREATE POLICY memo_skip_owner   ON memo_skip   USING (EXISTS (SELECT 1 FROM decision_memo m WHERE m.memo_id = memo_skip.memo_id));
CREATE POLICY memo_stress_owner ON memo_stress USING (EXISTS (SELECT 1 FROM decision_memo m WHERE m.memo_id = memo_stress.memo_id));
CREATE POLICY option_quote_owner ON option_quote USING (EXISTS (SELECT 1 FROM market_snapshot s WHERE s.market_snapshot_id = option_quote.market_snapshot_id));
CREATE POLICY option_leg_owner  ON option_leg  USING (EXISTS (SELECT 1 FROM wheel_cycle c WHERE c.cycle_id = option_leg.cycle_id));
CREATE POLICY share_lot_owner   ON share_lot   USING (EXISTS (SELECT 1 FROM wheel_cycle c WHERE c.cycle_id = share_lot.cycle_id));
CREATE POLICY tax_annotation_owner ON tax_annotation USING (EXISTS (SELECT 1 FROM ledger_entry e WHERE e.entry_id = tax_annotation.entry_id));
-- (the parent's own RLS policy makes these EXISTS checks user-scoped)

-- Auth bootstrap: before a user id is known, RLS would hide every row. These two narrow
-- SECURITY DEFINER functions are the only way around it (EC-SEC-006).
CREATE FUNCTION auth_lookup(p_email TEXT) RETURNS TABLE (user_id UUID, password_hash TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = app, pg_temp AS $$
  SELECT u.user_id, c.password_hash FROM app.app_user u JOIN app.credential c USING (user_id)
   WHERE lower(u.email) = lower(p_email) AND u.deleted_at IS NULL
$$;
CREATE FUNCTION session_resolve(p_token_sha256 BYTEA) RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = app, pg_temp AS $$
  SELECT s.user_id FROM app.session s
   WHERE s.token_sha256 = p_token_sha256 AND s.revoked_at IS NULL AND s.expires_at > now()
$$;
REVOKE ALL ON FUNCTION auth_lookup(TEXT), session_resolve(BYTEA) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup(TEXT), session_resolve(BYTEA), current_user_id() TO edge_app;

COMMIT;
