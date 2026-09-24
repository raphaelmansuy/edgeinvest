-- 003: job progress for the backtest progress bar (docs/05 SCR-023; EC-SM-004) and job/audit actions.
SET search_path = app, public;

ALTER TABLE job ADD COLUMN progress NUMERIC(4,3) NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 1);

-- Candidates are replaced while a memo is building (docs/07 §6, POST /memos/:id/candidates:score).
GRANT DELETE ON candidate TO edge_app;

-- Next ex-dividend date as entered by the user with the chain (R-EXDIV, SCR-036).
ALTER TABLE market_snapshot ADD COLUMN ex_dividend_date DATE;

INSERT INTO audit_action VALUES
  ('job_succeeded'),('job_failed'),('job_retry'),('audit_verified'),('remediation_opened'),('memo_discarded')
ON CONFLICT DO NOTHING;
