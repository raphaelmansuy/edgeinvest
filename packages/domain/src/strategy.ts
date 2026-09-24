// Candidate generation, T-bill hurdle and decision basis (docs/02 §4, §7, §10). Pure.
import { daysToExpiry, quoteIsStale } from "./calendar";
import { ENVELOPES, type EnvelopeId, inBand, otmFraction } from "./envelope";
import { type CoveredCallInvariants, coveredCallInvariants, type ShortPutInvariants, shortPutInvariants } from "./invariants";
import { divRound, sub, sum, type Usd4, usd4 } from "./money";

export const CONTRACTS_DEFAULT = 1;
export const WIDE_SPREAD_FRACTION = 0.1;

/** (p / K) × 365 / DTE — "for comparison with T-bill only, not a return" (G15). */
export const premiumYieldAnn = (premium: Usd4, strike: Usd4, dte: number) => (dte > 0 ? (premium / strike) * (365 / dte) : 0);
export const premiumYieldPeriod = (premium: Usd4, strike: Usd4) => premium / strike;

export interface QuoteRow {
  quoteId: string;
  putCall: "P" | "C";
  expiry: string;
  strike: Usd4;
  bid: Usd4 | null;
  ask: Usd4 | null;
}

export interface CandidateCtx {
  now: Date;
  spot: number;
  quotesAsOf: Date;
  envelopeId: EnvelopeId;
  rfRate: number; // annual decimal, cited
  settledCashUsd: Usd4;
  reservedOpenUsd: Usd4;
  phase: "cash-put" | "shares-held";
  costBasis: Usd4 | null; // shares-held phase
}

export interface Candidate {
  quoteId: string;
  putCall: "P" | "C";
  strike: Usd4;
  expiry: string;
  dte: number;
  otmPct: number;
  limitPrice: Usd4;
  bid: Usd4 | null;
  ask: Usd4 | null;
  put: ShortPutInvariants | null;
  call: CoveredCallInvariants | null;
  premiumYieldAnn: number;
  score: number | null;
  rank: number | null;
  rejectReasons: string[];
}

/** Generates and ranks candidates. Rejected rows stay visible with reasons and are never ranked (EC-PK-002). */
export function scoreCandidates(quotes: readonly QuoteRow[], ctx: CandidateCtx): Candidate[] {
  const env = ENVELOPES[ctx.envelopeId];
  const want = ctx.phase === "cash-put" ? "P" : "C";
  const stale = quoteIsStale(ctx.quotesAsOf, ctx.now);
  const rows = quotes.filter((q) => q.putCall === want).map((q): Candidate => {
    const dte = daysToExpiry(q.expiry, ctx.now);
    const otm = otmFraction(q.putCall, ctx.spot, q.strike / 10_000);
    const reasons: string[] = [];
    const bid = q.bid && q.bid > 0 ? q.bid : null;
    if (!bid) reasons.push("NO_BID");
    const limit = bid ?? usd4(0);
    if (stale) reasons.push("CHAIN_STALE");
    if (q.putCall === "P" && !inBand(otm, env.otmMin, env.otmMax)) reasons.push("OTM_OUTSIDE_ENVELOPE");
    if (q.putCall === "C" && otm < 0) reasons.push("CALL_ITM");
    if (dte < env.dteMin || dte > env.dteMax) reasons.push("DTE_OUTSIDE_ENVELOPE");
    if (bid && q.ask) {
      const mid = (bid + q.ask) / 2;
      if ((q.ask - bid) / mid > WIDE_SPREAD_FRACTION) reasons.push("WIDE_SPREAD");
    }
    let put: ShortPutInvariants | null = null;
    let call: CoveredCallInvariants | null = null;
    if (bid && bid < q.strike) {
      if (q.putCall === "P") {
        put = shortPutInvariants({ strike: q.strike, premium: bid, qty: CONTRACTS_DEFAULT });
        if (ctx.settledCashUsd - ctx.reservedOpenUsd < put.reserve) reasons.push("CASH_NOT_SECURED");
      } else if (ctx.costBasis !== null) {
        call = coveredCallInvariants({ strike: q.strike, premium: bid, qty: CONTRACTS_DEFAULT, costBasis: ctx.costBasis });
        if (call.lockedLoss) reasons.push("LOCKED_LOSS");
      }
    }
    const yieldAnn = bid ? premiumYieldAnn(bid, q.strike, dte) : 0;
    if (bid && q.putCall === "P" && yieldAnn < ctx.rfRate) reasons.push("PREMIUM_BELOW_TBILL");
    const spreadPenalty = bid && q.ask ? 0.5 * ((q.ask - bid) / ((bid + q.ask) / 2)) : 1;
    return {
      quoteId: q.quoteId, putCall: q.putCall, strike: q.strike, expiry: q.expiry, dte, otmPct: otm,
      limitPrice: limit, bid, ask: q.ask, put, call, premiumYieldAnn: yieldAnn,
      score: reasons.length ? null : yieldAnn - ctx.rfRate - spreadPenalty, rank: null, rejectReasons: reasons,
    };
  });
  const ranked = rows.filter((r) => r.score !== null).sort((a, b) => b.score! - a.score!);
  ranked.forEach((r, i) => { r.rank = i + 1; });
  const rejected = rows.filter((r) => r.score === null).sort((a, b) => a.strike - b.strike || a.expiry.localeCompare(b.expiry));
  return [...ranked, ...rejected];
}

/**
 * Decision basis for the covered-call rule (not tax basis, EC-WH-009):
 * B = K_assigned − (Σ put credits − Σ put buy-to-close debits in this cycle) / (100·q)
 */
export function decisionBasis(assignedStrike: Usd4, putCredits: readonly Usd4[], putDebits: readonly Usd4[], qty: number): Usd4 {
  const net = sub(sum(putCredits), sum(putDebits.map((d) => usd4(Math.abs(d)))));
  return sub(assignedStrike, divRound(net, 100 * qty));
}

/** Annualising fewer than four quarters is hidden (EC-LG-005). */
export function annualise(totalReturn: number, quarters: number): number | null {
  if (quarters < 4) return null;
  return (1 + totalReturn) ** (4 / quarters) - 1;
}

/** Leftover and next-lot funding are derived, never stored (G4). */
export function cashPosition(settledUsd: Usd4, reservedOpenUsd: Usd4, nextReserve: Usd4 | null) {
  const leftover = sub(settledUsd, reservedOpenUsd);
  return { reserved: reservedOpenUsd, leftover, targetFunded: nextReserve === null ? null : leftover >= nextReserve };
}
