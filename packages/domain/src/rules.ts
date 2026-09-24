// Draft checklist as a rule registry (Open/Closed: add a rule, don't edit the evaluator). docs/02 §8.
// The LLM never decides status; it only explains these deterministic results (docs/11, FP-11).
import { accountSnapshotIsStale, daysToExpiry, quoteIsStale } from "./calendar";
import { ENVELOPES, type EnvelopeId, inBand, otmFraction } from "./envelope";
import { shortPutInvariants } from "./invariants";
import { isCentTick, type Usd4 } from "./money";

export type Phase = "cash-put" | "shares-held";
export type Severity = "block" | "warn";
export type HaltReason =
  | "second_lot_without_cash" | "fx_loan" | "locked_loss_unsigned" | "willingness_declined"
  | "packet_incomplete" | "empty_chain" | "level_gap" | "paper_bar_missing";

export const ALLOWLIST = ["QQQ"] as const;

export interface DraftFields {
  underlying: string;
  side: "SELL" | "BUY";
  openClose: "open" | "close";
  putCall: "P" | "C";
  qty: number;
  strike: Usd4;
  expiry: string; // ISO date, ET calendar
  limitPrice: Usd4;
  orderType: string;
}

export interface DraftContext {
  now: Date;
  draft: DraftFields;
  quote: { bid: Usd4 | null; ask: Usd4 | null; asOf: Date; nonStandard?: boolean } | null;
  spot: number;
  envelopeId: EnvelopeId;
  phase: Phase;
  lotsOpen: number;
  lotsMax: number;
  settledCashUsd: Usd4;
  reservedOpenUsd: Usd4; // reserves already held by open short puts
  fxLoan: boolean;
  optionsLevel: number | null;
  accountAsOf: Date | null;
  packet: { hasCrash: boolean; hasMc: boolean };
  costBasis: Usd4 | null;
  lockedLossAccepted: boolean;
  haltReason: string | null;
  mode: "paper" | "live";
  liveEligible: boolean;
  exDividendDate: string | null;
}

export interface RuleResult { id: string; pass: boolean; severity: Severity; reason?: string }
export interface DraftRule {
  id: string;
  severity: Severity;
  reason: string;
  raisesHalt?: HaltReason;
  appliesTo(c: DraftContext): boolean;
  ok(c: DraftContext): boolean;
}

const always = () => true;
const opening = (c: DraftContext) => c.draft.openClose === "open";
const openingPut = (c: DraftContext) => opening(c) && c.draft.putCall === "P";
const openingCall = (c: DraftContext) => opening(c) && c.draft.putCall === "C";
const dte = (c: DraftContext) => daysToExpiry(c.draft.expiry, c.now);
const strikeDollars = (c: DraftContext) => c.draft.strike / 10_000;

export const DRAFT_RULES: readonly DraftRule[] = [
  { id: "R-SIDE", severity: "block", reason: "WRONG_SIDE", appliesTo: always,
    ok: (c) => (c.draft.openClose === "open") === (c.draft.side === "SELL") },
  { id: "R-LMT", severity: "block", reason: "NOT_LIMIT", appliesTo: always, ok: (c) => c.draft.orderType === "LMT" },
  { id: "R-TICK", severity: "block", reason: "OFF_TICK", appliesTo: always, ok: (c) => isCentTick(c.draft.limitPrice) },
  { id: "R-ALLOW", severity: "block", reason: "NOT_ALLOWLISTED", appliesTo: always,
    ok: (c) => (ALLOWLIST as readonly string[]).includes(c.draft.underlying) },
  { id: "R-CHAIN", severity: "block", reason: "EMPTY_CHAIN", appliesTo: opening,
    ok: (c) => c.quote !== null && c.quote.bid !== null && c.quote.ask !== null && c.quote.bid > 0 && !c.quote.nonStandard },
  { id: "R-STALE", severity: "block", reason: "CHAIN_STALE", appliesTo: opening,
    ok: (c) => c.quote !== null && !quoteIsStale(c.quote.asOf, c.now) },
  { id: "R-ACCT", severity: "block", reason: "STALE_ACCOUNT_SNAPSHOT", appliesTo: opening,
    ok: (c) => c.accountAsOf !== null && !accountSnapshotIsStale(c.accountAsOf, c.now) },
  { id: "R-PHASE", severity: "block", reason: "PHASE_MISMATCH", appliesTo: opening,
    ok: (c) => (c.draft.putCall === "P") === (c.phase === "cash-put") },
  { id: "R-LOTS", severity: "block", reason: "SECOND_LOT_WITHOUT_CASH", raisesHalt: "second_lot_without_cash",
    appliesTo: openingPut, ok: (c) => c.lotsOpen + c.draft.qty <= c.lotsMax },
  { id: "R-OTM", severity: "block", reason: "OTM_OUTSIDE_ENVELOPE", appliesTo: openingPut, ok: (c) => {
    const e = ENVELOPES[c.envelopeId];
    return inBand(otmFraction("P", c.spot, strikeDollars(c)), e.otmMin, e.otmMax);
  } },
  { id: "R-DTE", severity: "block", reason: "DTE_OUTSIDE_ENVELOPE", appliesTo: opening, ok: (c) => {
    const e = ENVELOPES[c.envelopeId];
    const d = dte(c);
    return d >= e.dteMin && d <= e.dteMax;
  } },
  { id: "R-CASH", severity: "block", reason: "CASH_NOT_SECURED", appliesTo: openingPut, ok: (c) => {
    if (c.draft.limitPrice <= 0 || c.draft.limitPrice >= c.draft.strike || c.draft.qty < 1) return false;
    const { reserve } = shortPutInvariants({ strike: c.draft.strike, premium: c.draft.limitPrice, qty: c.draft.qty });
    return c.settledCashUsd - c.reservedOpenUsd >= reserve;
  } },
  { id: "R-FX", severity: "block", reason: "FX_LOAN", raisesHalt: "fx_loan", appliesTo: opening, ok: (c) => !c.fxLoan },
  { id: "R-LEVEL", severity: "block", reason: "LEVEL_GAP", raisesHalt: "level_gap", appliesTo: opening,
    ok: (c) => (c.optionsLevel ?? 0) >= (c.draft.putCall === "P" ? 3 : 1) },
  { id: "R-PACKET", severity: "block", reason: "PACKET_INCOMPLETE", appliesTo: openingPut,
    ok: (c) => c.packet.hasCrash && c.packet.hasMc },
  { id: "R-BASIS", severity: "block", reason: "LOCKED_LOSS_UNSIGNED", appliesTo: openingCall,
    ok: (c) => c.costBasis !== null && (c.draft.strike >= c.costBasis || c.lockedLossAccepted) },
  // Halts never block risk-reducing closes (buy to close): opening only.
  { id: "R-HALT", severity: "block", reason: "HALT_ACTIVE", appliesTo: opening, ok: (c) => c.haltReason === null },
  { id: "R-MODE", severity: "block", reason: "LIVE_NOT_ELIGIBLE", appliesTo: (c) => c.mode === "live",
    ok: (c) => c.liveEligible },
  { id: "R-EXDIV", severity: "warn", reason: "EXDIV_ASSIGNMENT_RISK", appliesTo: openingCall,
    ok: (c) => c.exDividendDate === null || c.exDividendDate > c.draft.expiry },
  { id: "R-ITM", severity: "warn", reason: "CALL_ITM", appliesTo: openingCall, ok: (c) => strikeDollars(c) >= c.spot },
];

export interface DraftEvaluation {
  status: "open" | "blocked";
  reasons: string[];
  warnings: string[];
  results: RuleResult[];
  haltsToRaise: HaltReason[];
}

export function evaluateDraft(c: DraftContext, rules: readonly DraftRule[] = DRAFT_RULES): DraftEvaluation {
  const applicable = rules.filter((r) => r.appliesTo(c));
  const results: RuleResult[] = applicable.map((r) =>
    r.ok(c) ? { id: r.id, pass: true, severity: r.severity } : { id: r.id, pass: false, severity: r.severity, reason: r.reason });
  const failed = (sev: Severity) => results.filter((r) => !r.pass && r.severity === sev).map((r) => r.reason!);
  const reasons = failed("block");
  const haltsToRaise = applicable
    .filter((r) => r.raisesHalt && results.find((x) => x.id === r.id && !x.pass))
    .map((r) => r.raisesHalt!);
  return { status: reasons.length ? "blocked" : "open", reasons, warnings: failed("warn"), results, haltsToRaise };
}

/** Human-readable fix for each reason code; the UI and the agent quote the same text (DRY). */
export const REASON_TEXT: Readonly<Record<string, { title: string; fix: string }>> = {
  WRONG_SIDE: { title: "Wrong side for the intent", fix: "Opening a cash-secured put is SELL to open; closing is BUY to close." },
  NOT_LIMIT: { title: "Market orders are not allowed", fix: "Use a limit order. The default limit is the bid." },
  OFF_TICK: { title: "Limit is not on the 0.01 tick", fix: "Round the limit to a whole cent." },
  NOT_ALLOWLISTED: { title: "Underlying is not on the allowlist", fix: "Only QQQ is supported in this version." },
  EMPTY_CHAIN: { title: "No usable quote", fix: "No quote, refusing to invent one. Capture a chain on Decide › Inputs." },
  CHAIN_STALE: { title: "Quote is stale", fix: "Capture a fresh quote (15 min during the session, or since the last close)." },
  STALE_ACCOUNT_SNAPSHOT: { title: "Account snapshot is older than 24 h", fix: "Re-capture settled cash and balances on Decide › Inputs." },
  PHASE_MISMATCH: { title: "Instrument does not match your phase", fix: "Puts in the cash-put phase, covered calls only while you hold shares." },
  SECOND_LOT_WITHOUT_CASH: { title: "One lot at a time", fix: "lots_max is 1. Close or finish the open cycle first." },
  OTM_OUTSIDE_ENVELOPE: { title: "Strike is outside your envelope", fix: "Pick a strike inside the envelope's OTM band." },
  DTE_OUTSIDE_ENVELOPE: { title: "Expiry is outside your envelope", fix: "Pick an expiry between the envelope's DTE bounds (ET calendar)." },
  CASH_NOT_SECURED: { title: "Not fully cash-secured", fix: "Settled USD minus reserves already held must cover strike × 100 × qty." },
  FX_LOAN: { title: "A currency balance is negative", fix: "A negative HKD or USD balance is a loan. Repay it before opening anything." },
  LEVEL_GAP: { title: "Options permission too low", fix: "Cash-secured puts need IBKR options Level 3." },
  PACKET_INCOMPLETE: { title: "Stress tests missing", fix: "Attach a crash replay and a Monte Carlo run to the packet first." },
  LOCKED_LOSS_UNSIGNED: { title: "Call strike below your decision basis", fix: "Choose Kc ≥ basis, or accept the locked loss on Execute › Halt / veto." },
  HALT_ACTIVE: { title: "Account is halted", fix: "Resolve the halt cause, then clear it on Execute › Halt / veto." },
  LIVE_NOT_ELIGIBLE: { title: "Live mode is not unlocked", fix: "Live needs mastery and every Execute disclosure acknowledged." },
  EXDIV_ASSIGNMENT_RISK: { title: "Ex-dividend date before expiry", fix: "Early assignment is more likely just before the ex-dividend date." },
  CALL_ITM: { title: "Call strike is below spot (in the money)", fix: "An ITM call is likely to be assigned; check this is intended." },
};
