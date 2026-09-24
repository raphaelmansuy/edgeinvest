-- Behavioural verification of 001_init.sql. Run as edge_app (non-superuser, RLS enforced).
\set ON_ERROR_STOP 1
SET search_path = app, public;

-- helper: assert that a statement fails with a message fragment
CREATE OR REPLACE FUNCTION pg_temp.expect_fail(stmt TEXT, fragment TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(fragment IN SQLERRM) > 0 THEN RETURN 'PASS  ' || fragment; END IF;
    RETURN 'FAIL  wrong error: ' || SQLERRM;
  END;
  RETURN 'FAIL  no error for: ' || left(stmt, 60);
END $$;

-- two users, created under their own RLS identity
BEGIN;
SELECT set_config('app.user_id', '01900000-0000-7000-8000-00000000000a', true);
INSERT INTO app_user (user_id, email) VALUES ('01900000-0000-7000-8000-00000000000a', 'a@example.com');
INSERT INTO credential VALUES ('01900000-0000-7000-8000-00000000000a', '$argon2id$v=19$m=65536,t=2,p=1$x$y');
INSERT INTO wheel_state (user_id) VALUES ('01900000-0000-7000-8000-00000000000a');
COMMIT;
BEGIN;
SELECT set_config('app.user_id', '01900000-0000-7000-8000-00000000000b', true);
INSERT INTO app_user (user_id, email) VALUES ('01900000-0000-7000-8000-00000000000b', 'b@example.com');
INSERT INTO wheel_state (user_id) VALUES ('01900000-0000-7000-8000-00000000000b');
COMMIT;

BEGIN;
SELECT set_config('app.user_id', '01900000-0000-7000-8000-00000000000a', true);

-- [EC-SEC-002] RLS isolation
SELECT CASE WHEN count(*) = 1 THEN 'PASS  RLS: user A sees only itself' ELSE 'FAIL  RLS leak' END FROM app_user;
SELECT pg_temp.expect_fail($$INSERT INTO wheel_state (user_id) VALUES ('01900000-0000-7000-8000-00000000000b')$$,
                           'row-level security');
-- [EC-SEC-006] auth bootstrap works despite RLS
SELECT CASE WHEN count(*) = 1 THEN 'PASS  auth_lookup bypasses RLS narrowly' ELSE 'FAIL auth_lookup' END
  FROM auth_lookup('A@EXAMPLE.COM');

-- [EC-DB-001] uuidv7 default is version 7
INSERT INTO account_snapshot (user_id, mode, as_of, usd_settled_cash, hkd_cash, source)
VALUES (current_user_id(), 'paper', now(), 100000, -5, 'manual');
SELECT CASE WHEN uuid_extract_version(snapshot_id) = 7 AND fx_loan_flag
            THEN 'PASS  uuidv7 PK + virtual fx_loan_flag=true for HKD -5' ELSE 'FAIL uuid/fx' END
  FROM account_snapshot;

-- [EC-DB-002] temporal PK: overlapping envelope periods rejected
INSERT INTO envelope_selection VALUES (current_user_id(), 'beginner_v1', tstzrange('2026-09-01', NULL), false);
SELECT pg_temp.expect_fail($$INSERT INTO envelope_selection VALUES (app.current_user_id(), 'mentor_cyrille_v1',
                             tstzrange('2026-09-10', NULL), true)$$, 'conflicting key');

-- [EC-DB-003] audit append-only + hash chain
INSERT INTO audit_event (user_id, actor, action, scr_id, payload, payload_hash)
VALUES (current_user_id(), 'user', 'envelope_changed', 'SCR-071', '{"to":"beginner_v1"}', sha256('p1')),
       (current_user_id(), 'user', 'skip_recorded',    'SCR-032', '{"code":"other"}',      sha256('p2'));
SELECT CASE WHEN max(seq) = 2 AND bool_and(chain_hash IS NOT NULL)
             AND (SELECT prev_hash FROM audit_event WHERE seq = 2) = (SELECT chain_hash FROM audit_event WHERE seq = 1)
            THEN 'PASS  audit seq 1..2, chain links' ELSE 'FAIL chain' END FROM audit_event;
SELECT pg_temp.expect_fail($$UPDATE app.audit_event SET scr_id = 'SCR-000'$$, 'permission denied');
SELECT pg_temp.expect_fail($$DELETE FROM app.audit_event$$, 'permission denied');
SELECT pg_temp.expect_fail($$INSERT INTO app.audit_event (user_id, actor, action, payload, payload_hash)
                             VALUES (app.current_user_id(), 'user', 'made_up_action', '{}', sha256('x'))$$, 'foreign key');

-- [EC-WH-003] lots_max = 1: second open cycle refused; RETURNING OLD/NEW (PG18) for audit
INSERT INTO wheel_cycle (user_id, mode) VALUES (current_user_id(), 'paper');
SELECT pg_temp.expect_fail($$INSERT INTO app.wheel_cycle (user_id, mode) VALUES (app.current_user_id(), 'paper')$$,
                           'LOTS_EXCEEDED');
UPDATE wheel_cycle SET state = 'shares_held' WHERE user_id = current_user_id()
RETURNING 'PASS  RETURNING old/new: ' || old.state || ' -> ' || new.state || ' phase=' || new.phase;

-- [EC-WH-005] illegal transition shares_held -> short_put_open
SELECT pg_temp.expect_fail($$UPDATE app.wheel_cycle SET state = 'short_put_open'$$, 'ILLEGAL_TRANSITION');

-- [EC-WH-006] halt blocks any new cycle
UPDATE wheel_cycle SET state = 'closed', closed_at = now();          -- shares_held -> closed (sold)
UPDATE wheel_state SET halt_reason = 'fx_loan', halted_at = now();
SELECT pg_temp.expect_fail($$INSERT INTO app.wheel_cycle (user_id, mode) VALUES (app.current_user_id(), 'paper')$$,
                           'HALT_ACTIVE');
UPDATE wheel_state SET halt_reason = NULL, halted_at = NULL;

-- [EC-DR-001] wrong-side draft is unrepresentable
SELECT pg_temp.expect_fail($$INSERT INTO app.draft_preview (user_id, account_mode, side, open_close, put_call, qty,
  strike, expiry, limit_price, checklist) VALUES (app.current_user_id(), 'paper', 'BUY', 'open', 'P', 1, 650,
  '2026-11-20', 9.80, '{}')$$, 'draft_preview_check');
SELECT pg_temp.expect_fail($$INSERT INTO app.draft_preview (user_id, account_mode, side, open_close, put_call, qty,
  strike, expiry, limit_price, order_type, checklist) VALUES (app.current_user_id(), 'paper', 'SELL', 'open', 'P', 1,
  650, '2026-11-20', 9.80, 'MKT', '{}')$$, 'order_type_check');
SELECT pg_temp.expect_fail($$INSERT INTO app.draft_preview (user_id, account_mode, side, open_close, put_call, qty,
  strike, expiry, limit_price, status, checklist) VALUES (app.current_user_id(), 'paper', 'SELL', 'open', 'P', 1,
  650, '2026-11-20', 9.80, 'blocked', '{}')$$, 'draft_preview_check');

-- [EC-PK-004] a 'sell' decision needs a written pre-commitment plan
SELECT pg_temp.expect_fail($$INSERT INTO app.decision_memo (user_id, decision_date, phase, envelope_id, status,
  decision, decided_at) VALUES (app.current_user_id(), '2026-09-23', 'cash-put', 'beginner_v1', 'decided', 'sell',
  now())$$, 'decision_memo_check');

-- [EC-PK-006] Skip 'other' needs a note (NULL must not slip through)
INSERT INTO decision_memo (memo_id, user_id, decision_date, phase, envelope_id)
VALUES ('01900000-0000-7000-8000-0000000000c1', current_user_id(), '2026-09-23', 'cash-put', 'beginner_v1');
SELECT pg_temp.expect_fail($$INSERT INTO app.memo_skip (memo_id, code) VALUES
  ('01900000-0000-7000-8000-0000000000c1', 'other')$$, 'memo_skip_check');

-- [EC-LG-002] ledger sign discipline; virtual quarter + HK year of assessment
INSERT INTO ledger_entry (user_id, mode, kind, amount_usd, trade_date, source) VALUES
  (current_user_id(), 'paper', 'put_premium', 980, '2026-03-31', 'manual'),
  (current_user_id(), 'paper', 'put_premium', 980, '2026-04-01', 'manual');
SELECT 'PASS  ' || string_agg(trade_date || '→' || quarter_label || ' YoA ' || hk_year_of_assessment, ' | ' ORDER BY trade_date)
  FROM ledger_entry;
SELECT pg_temp.expect_fail($$INSERT INTO app.ledger_entry (user_id, mode, kind, amount_usd, trade_date, source)
  VALUES (app.current_user_id(), 'paper', 'fee', 1.05, '2026-04-01', 'manual')$$, 'ledger_entry_check');
SELECT pg_temp.expect_fail($$UPDATE app.ledger_entry SET amount_usd = 1$$, 'permission denied');

-- [EC-LN-003] virtual quiz pass flag honours the threshold used at grading time
INSERT INTO quiz_attempt (user_id, module_code, content_version, score_pct, answers)
VALUES (current_user_id(), 'M3', 1, 79.99, '{}'), (current_user_id(), 'M3', 1, 80, '{}');
SELECT CASE WHEN array_agg(passed ORDER BY score_pct) = '{f,t}' THEN 'PASS  quiz 79.99 fail / 80 pass'
            ELSE 'FAIL quiz' END FROM quiz_attempt;

-- [EC-LN-004] mastery cannot be marked complete early
SELECT pg_temp.expect_fail($$INSERT INTO app.mastery_progress (user_id, all_passed_at)
  VALUES (app.current_user_id(), now())$$, 'mastery_progress_check');

-- [EC-MD-003] crossed quote rejected; [EC-MD-005] future-dated snapshot rejected
INSERT INTO market_snapshot (user_id, spot, as_of, source) VALUES (current_user_id(), 721.11, now(), 'manual');
SELECT pg_temp.expect_fail($$INSERT INTO app.option_quote (market_snapshot_id, put_call, expiry, strike, bid, ask)
  SELECT market_snapshot_id, 'P', '2026-11-20', 650, 9.90, 9.80 FROM app.market_snapshot$$, 'option_quote_check');
SELECT pg_temp.expect_fail($$INSERT INTO app.market_snapshot (user_id, spot, as_of, source)
  VALUES (app.current_user_id(), 700, now() + interval '1 day', 'manual')$$, 'market_snapshot_check');
-- [EC-MD-006] rate without https citation rejected
SELECT pg_temp.expect_fail($$INSERT INTO app.rate_snapshot (user_id, kind, rate, as_of, source_url)
  VALUES (app.current_user_id(), 'tbill_13w', 0.0378, '2026-08-27', 'meeting notes')$$, 'rate_snapshot_source_url_check');

-- [EC-DB-007] stress results are immutable
INSERT INTO stress_result (user_id, kind, model_version, seed, input_hash, params, summary, claim_label)
VALUES (current_user_id(), 'mc', 'csp-mc-bootstrap-q-v1', 20260828, 'sha256:' || repeat('a', 64), '{}', '{}', 'sourced_sim');
SELECT pg_temp.expect_fail($$UPDATE app.stress_result SET summary = '{"cagr_p50":0.08}'$$, 'permission denied');
COMMIT;

-- [EC-LG-001] one ledger, two derived views; [EC-DB-011] views honour RLS (security_invoker)
BEGIN;
SELECT set_config('app.user_id', '01900000-0000-7000-8000-00000000000a', true);
SELECT CASE WHEN (SELECT count(*) FROM v_ledger_by_quarter) = 2 AND (SELECT count(*) FROM v_ledger_by_hk_yoa) = 2
             AND (SELECT count(*) FROM v_memo_packet WHERE NOT packet_complete) = 1
             AND (SELECT lots_open FROM v_wheel_summary) = 0
            THEN 'PASS  A: quarter + HK-YoA views, packet incomplete, lots_open 0' ELSE 'FAIL views for A' END;
COMMIT;

-- [EC-SEC-002] user B sees none of A's financial rows (tables AND views)
BEGIN;
SELECT set_config('app.user_id', '01900000-0000-7000-8000-00000000000b', true);
SELECT CASE WHEN (SELECT count(*) FROM audit_event) + (SELECT count(*) FROM ledger_entry)
               + (SELECT count(*) FROM option_quote) + (SELECT count(*) FROM wheel_cycle) = 0
            THEN 'PASS  RLS: user B sees 0 of A''s audit/ledger/quotes/cycles' ELSE 'FAIL RLS leak for B' END;
SELECT CASE WHEN (SELECT count(*) FROM v_memo_packet) + (SELECT count(*) FROM v_ledger_by_quarter)
               + (SELECT count(*) FROM v_ledger_by_hk_yoa) = 0 AND (SELECT count(*) FROM v_wheel_summary) = 1
            THEN 'PASS  RLS: views are security_invoker (B sees only own wheel summary)' ELSE 'FAIL view leak' END;
COMMIT;

-- [EC-SEC-002] no app.user_id set ⇒ no rows at all (fail closed)
SELECT CASE WHEN count(*) = 0 THEN 'PASS  RLS fails closed without app.user_id' ELSE 'FAIL open' END FROM ledger_entry;
