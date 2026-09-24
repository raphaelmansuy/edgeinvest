-- 002_app.sql — additions discovered while wiring the API (docs/09 §12: forward-only migrations)
BEGIN;
SET search_path = app, public;

-- Audit actions used by use cases beyond the compliance minimum (docs/12 §7).
INSERT INTO audit_action VALUES
  ('profile_updated'),('inputs_captured'),('memo_created'),('candidates_scored'),('stress_attached'),
  ('memo_decided'),('draft_reviewed'),('draft_discarded'),('playbook_step'),('lifecycle_event'),
  ('willingness_recorded'),('quiz_graded'),('game_graded'),('evidence_recorded'),('backtest_queued'),
  ('annotation_updated'),('agent_turn'),('agent_blocked_draft'),('sim_run')
ON CONFLICT DO NOTHING;

-- Optimistic concurrency for editable memos (ETag / If-Match ⇒ STALE_WRITE, docs/07 §8.2).
ALTER TABLE decision_memo ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Envelope params hash = sha256 of the canonical string produced by packages/domain envelopeParamsCanonical().
UPDATE envelope SET params_sha256 = encode(sha256(convert_to(
  '{"dte_max":120,"dte_min":60,"lots_max":1,"otm_max":0.12,"otm_min":0.05,"requires_mastery":false}', 'UTF8')), 'hex')
 WHERE envelope_id = 'beginner_v1';
UPDATE envelope SET params_sha256 = encode(sha256(convert_to(
  '{"dte_max":120,"dte_min":60,"lots_max":1,"otm_max":0.3,"otm_min":0.16,"requires_mastery":true}', 'UTF8')), 'hex')
 WHERE envelope_id = 'mentor_cyrille_v1';

-- Paper-lab starting cash chosen on SCR-101 (simulation only; never a real snapshot, ADR-014).
ALTER TABLE app_user ADD COLUMN paper_start_cash NUMERIC(18,4) NOT NULL DEFAULT 100000 CHECK (paper_start_cash > 0);
ALTER TABLE app_user ADD COLUMN theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system','light','dark'));
-- Onboarding acks count only if newer than the last jurisdiction change (docs/12 §4). New users start unset.
ALTER TABLE app_user ALTER COLUMN jurisdiction DROP NOT NULL;
ALTER TABLE app_user ALTER COLUMN jurisdiction DROP DEFAULT;
ALTER TABLE app_user ADD COLUMN jurisdiction_set_at TIMESTAMPTZ NOT NULL DEFAULT '-infinity';

-- Playbook step completion (SCR-040/043) and willingness answers (SCR-035) are part of the draft/wheel record.
ALTER TABLE draft_preview ADD COLUMN steps_done TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE draft_preview ADD COLUMN review JSONB;
ALTER TABLE wheel_state ADD COLUMN willingness_confirmed_at TIMESTAMPTZ;
ALTER TABLE wheel_state ADD COLUMN locked_loss_accepted_for UUID;

-- Worker job claim across users. RLS hides other users' rows, so claiming is a narrow SECURITY DEFINER
-- function that returns only ids; the worker then processes each job inside that user's RLS context.
CREATE FUNCTION claim_job(p_worker TEXT) RETURNS TABLE (job_id UUID, user_id UUID)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = app, pg_temp AS $$
  UPDATE app.job SET status = 'running', locked_by = p_worker, locked_at = now(), attempts = attempts + 1, updated_at = now()
   WHERE job_id = (SELECT j.job_id FROM app.job j
                    WHERE j.status = 'queued' AND j.run_after <= now()
                    ORDER BY j.run_after FOR UPDATE SKIP LOCKED LIMIT 1)
  RETURNING job.job_id, job.user_id
$$;
CREATE FUNCTION reap_jobs() RETURNS INT
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = app, pg_temp AS $$
  WITH r AS (UPDATE app.job SET status = 'queued', locked_by = NULL, locked_at = NULL, updated_at = now()
              WHERE status = 'running' AND locked_at < now() - interval '10 minutes' AND attempts < max_attempts
             RETURNING 1)
  SELECT count(*)::int FROM r
$$;
CREATE FUNCTION purge_idempotency() RETURNS INT
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = app, pg_temp AS $$
  WITH d AS (DELETE FROM app.idempotency_key WHERE expires_at < now() RETURNING 1) SELECT count(*)::int FROM d
$$;
REVOKE ALL ON FUNCTION claim_job(TEXT), reap_jobs(), purge_idempotency() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_job(TEXT), reap_jobs(), purge_idempotency() TO edge_app;

-- Jobs notify the worker (LISTEN/NOTIFY wake-up, docs/07 §11).
CREATE FUNCTION job_notify() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM pg_notify('job_queued', NEW.job_id::text); RETURN NEW; END $$;
CREATE TRIGGER job_notify_trg AFTER INSERT ON job FOR EACH ROW EXECUTE FUNCTION job_notify();

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA app TO edge_app;
REVOKE UPDATE ON audit_event, ledger_entry, competency_evidence, stress_result FROM edge_app;
GRANT DELETE ON session, idempotency_key, memo_stress TO edge_app;
COMMIT;
