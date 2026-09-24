// Draft checklist as a rule registry (Open/Closed: add a rule, don't edit the evaluator).
// The LLM never decides status; it only explains these deterministic results (docs/11).
import { ENVELOPES, type EnvelopeId, inBand, otmFraction } from "./envelope";
import { shortPutInvariants } from "./invariants";
import type { Usd4 } from "./money";

export type Phase = "cash-put" | "shares-held";

export interface DraftContext {
  draft: { side: "SELL" | "BUY"; openClose: "open" | "close"; putCall: "P" | "C"; qty: number;
           strike: Usd4; limitPrice: Usd4; orderType: string; dte: number };
  spot: number;
  envelopeId: EnvelopeId;
  phase: Phase;
  lotsOpen: number; lotsMax: number;
  settledCashUsd: Usd4; fxLoan: boolean;
  optionsLevel: number | null;
  packetComplete: boolean;
  costBasis: Usd4 | null; lockedLossAccepted: boolean;
  chainHasBidAsk: boolean;
}

export interface RuleResult { id: string; pass: boolean; reason?: string }
export interface DraftRule { id: string; appliesTo(c: DraftContext): boolean; check(c: DraftContext): RuleResult }

const rule = (id: string, appliesTo: DraftRule["appliesTo"], ok: (c: DraftContext) => boolean, reason: string): DraftRule =>
  ({ id, appliesTo, check: (c) => (ok(c) ? { id, pass: true } : { id, pass: false, reason }) });

const opening = (c: DraftContext) => c.draft.openClose === "open";
const openingPut = (c: DraftContext) => opening(c) && c.draft.putCall === "P";
const openingCall = (c: DraftContext) => opening(c) && c.draft.putCall === "C";

export const DRAFT_RULES: readonly DraftRule[] = [
  rule("side_matches_intent", () => true,
    (c) => (c.draft.openClose === "open") === (c.draft.side === "SELL"), "WRONG_SIDE"),
  rule("limit_only", () => true, (c) => c.draft.orderType === "LMT", "NOT_LIMIT"),
  rule("chain_present", opening, (c) => c.chainHasBidAsk, "EMPTY_CHAIN"),
  rule("phase_matches_instrument", opening,
    (c) => (c.draft.putCall === "P") === (c.phase === "cash-put"), "PHASE_MISMATCH"),
  rule("lots_available", openingPut, (c) => c.lotsOpen + c.draft.qty <= c.lotsMax, "SECOND_LOT_WITHOUT_CASH"),
  rule("otm_in_envelope", opening, (c) => {
    const e = ENVELOPES[c.envelopeId];
    return inBand(otmFraction(c.draft.putCall, c.spot, c.draft.strike / 10_000), e.otmMin, e.otmMax);
  }, "OTM_OUTSIDE_ENVELOPE"),
  rule("dte_in_envelope", opening, (c) => {
    const e = ENVELOPES[c.envelopeId];
    return c.draft.dte >= e.dteMin && c.draft.dte <= e.dteMax;
  }, "DTE_OUTSIDE_ENVELOPE"),
  rule("cash_secured", openingPut, (c) => {
    const { reserve } = shortPutInvariants({ strike: c.draft.strike, premium: c.draft.limitPrice, qty: c.draft.qty });
    return c.settledCashUsd >= reserve;
  }, "CASH_NOT_SECURED"),
  rule("no_fx_loan", opening, (c) => !c.fxLoan, "FX_LOAN"),
  rule("options_level", opening,
    (c) => (c.optionsLevel ?? 0) >= (c.draft.putCall === "P" ? 3 : 1), "LEVEL_GAP"),
  rule("packet_complete", opening, (c) => c.packetComplete, "PACKET_INCOMPLETE"),
  rule("call_strike_ge_basis", openingCall,
    (c) => c.costBasis !== null && (c.draft.strike >= c.costBasis || c.lockedLossAccepted), "LOCKED_LOSS_UNSIGNED"),
];

export function evaluateDraft(c: DraftContext, rules: readonly DraftRule[] = DRAFT_RULES) {
  const results = rules.filter((r) => r.appliesTo(c)).map((r) => r.check(c));
  const reasons = results.filter((r) => !r.pass).map((r) => r.reason!);
  return { status: reasons.length ? ("blocked" as const) : ("open" as const), reasons, results };
}
