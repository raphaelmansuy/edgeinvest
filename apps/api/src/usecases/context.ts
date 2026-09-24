// Derived per-user state read by capabilities, drafts, candidates and chrome (derive, don't store: docs/09 §3).
import { type EnvelopeId, parseUsd4, type Phase, sub, toDecimalString, type Usd4, usd4 } from "@edge/domain";
import type { Tx } from "../ports";

export interface CycleRow {
  cycle_id: string;
  state: "short_put_open" | "shares_held" | "shares_short_call" | "closed";
  mode: "paper" | "live";
  opened_at: Date;
}

export interface WheelContext {
  mode: "paper" | "live";
  envelopeId: EnvelopeId;
  envelopeOverride: boolean;
  phase: Phase;
  openCycles: CycleRow[];
  lotsOpen: number;
  lotsMax: number;
  reservedUsd: Usd4;
  haltReason: string | null;
  haltedAt: Date | null;
  version: number;
  willingnessConfirmedAt: Date | null;
  lockedLossAcceptedFor: string | null;
  account: { snapshotId: string; asOf: Date; settled: Usd4; hkd: Usd4; fxLoan: boolean; optionsLevel: number | null; nlv: string | null } | null;
  masteryAllPass: boolean;
}

export async function currentEnvelope(tx: Tx) {
  const [e] = await tx.sql`select envelope_id, override_before_mastery from app.envelope_selection
                             where valid_during @> now() order by lower(valid_during) desc limit 1`;
  return { envelopeId: (e?.envelope_id ?? "beginner_v1") as EnvelopeId, override: Boolean(e?.override_before_mastery) };
}

export async function loadWheelContext(tx: Tx, opts: { forUpdate?: boolean } = {}): Promise<WheelContext> {
  const [ws] = opts.forUpdate
    ? await tx.sql`select * from app.wheel_state where user_id = ${tx.userId} for update`
    : await tx.sql`select * from app.wheel_state where user_id = ${tx.userId}`;
  const [user] = await tx.sql`select account_mode from app.app_user where user_id = ${tx.userId}`;
  const mode = (user?.account_mode ?? "paper") as "paper" | "live";
  const cycles = (await tx.sql`select cycle_id, state, mode, opened_at from app.wheel_cycle
                                where state <> 'closed' order by opened_at`) as CycleRow[];
  const [res] = await tx.sql`select coalesce(sum(l.strike * 100 * l.qty), 0)::numeric(18,4) as reserved
                               from app.wheel_cycle c join app.option_leg l on l.cycle_id = c.cycle_id
                              where c.state = 'short_put_open' and l.put_call = 'P' and l.closed_at is null`;
  const [acct] = await tx.sql`select snapshot_id, as_of, usd_settled_cash, hkd_cash, fx_loan_flag, options_level, nlv_usd
                                from app.account_snapshot where mode = ${mode} order by as_of desc limit 1`;
  const [mp] = await tx.sql`select all_passed_at from app.mastery_progress where user_id = ${tx.userId}`;
  const env = await currentEnvelope(tx);
  const shares = cycles.some((c) => c.state === "shares_held" || c.state === "shares_short_call");
  return {
    mode,
    envelopeId: env.envelopeId,
    envelopeOverride: env.override,
    phase: shares ? "shares-held" : "cash-put",
    openCycles: cycles,
    lotsOpen: cycles.length,
    lotsMax: ws?.lots_max ?? 1,
    reservedUsd: parseUsd4(res?.reserved ?? "0"),
    haltReason: ws?.halt_reason ?? null,
    haltedAt: ws?.halted_at ?? null,
    version: Number(ws?.version ?? 0),
    willingnessConfirmedAt: ws?.willingness_confirmed_at ?? null,
    lockedLossAcceptedFor: ws?.locked_loss_accepted_for ?? null,
    account: acct ? {
      snapshotId: acct.snapshot_id, asOf: acct.as_of, settled: parseUsd4(acct.usd_settled_cash), hkd: parseUsd4(acct.hkd_cash),
      fxLoan: Boolean(acct.fx_loan_flag), optionsLevel: acct.options_level, nlv: acct.nlv_usd,
    } : null,
    masteryAllPass: Boolean(mp?.all_passed_at),
  };
}

export const leftoverOf = (w: WheelContext) => (w.account ? sub(w.account.settled, w.reservedUsd) : usd4(0));
export const moneyStr = (v: Usd4) => toDecimalString(v);

/** Raise a halt (idempotent on the same reason) with audit in the same transaction (docs/04 §4.4). */
export async function raiseHalt(tx: Tx, reason: string, evidence: Record<string, unknown>, scr?: string) {
  const [ws] = await tx.sql`select halt_reason from app.wheel_state where user_id = ${tx.userId} for update`;
  if (ws?.halt_reason) return false;
  await tx.sql`update app.wheel_state set halt_reason = ${reason}, halted_at = now(), version = version + 1, updated_at = now()
                where user_id = ${tx.userId}`;
  await tx.audit({ action: "halt_raised", scr: (scr ?? "SCR-045") as never, actor: "system", payload: { reason, evidence: evidence as never } });
  return true;
}
