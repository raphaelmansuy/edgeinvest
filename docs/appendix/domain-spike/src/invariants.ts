import { type Usd4, sub, times, usd4 } from "./money";

export const CONTRACT_MULTIPLIER = 100;

export interface ShortPutInput { strike: Usd4; premium: Usd4; qty: number }
export interface ShortPutInvariants {
  reserve: Usd4;     // strike × 100 × qty — cash that must sit idle, in USD
  maxProfit: Usd4;   // premium × 100 × qty — gross of fees
  breakEven: Usd4;   // strike − premium (per share)
  worstCase: Usd4;   // underlying → 0: reserve − maxProfit
}

export function shortPutInvariants({ strike, premium, qty }: ShortPutInput): ShortPutInvariants {
  assertQty(qty);
  if (strike <= 0) throw new RangeError("STRIKE_NOT_POSITIVE");
  if (premium <= 0) throw new RangeError("PREMIUM_NOT_POSITIVE");
  if (premium >= strike) throw new RangeError("PREMIUM_GE_STRIKE");   // impossible quote → refuse
  const reserve = times(strike, CONTRACT_MULTIPLIER * qty);
  const maxProfit = times(premium, CONTRACT_MULTIPLIER * qty);
  return { reserve, maxProfit, breakEven: sub(strike, premium), worstCase: sub(reserve, maxProfit) };
}

export interface CoveredCallInput { strike: Usd4; premium: Usd4; qty: number; costBasis: Usd4 }
export interface CoveredCallInvariants {
  sharesCovered: number;
  maxProfit: Usd4;           // credit + (strike − basis) × shares if called away
  creditOnly: Usd4;          // premium × 100 × qty
  lockedLoss: boolean;       // strike < basis ⇒ being called away realises a loss
  worstCase: Usd4;           // shares → 0: basis × shares − credit
}

export function coveredCallInvariants(i: CoveredCallInput): CoveredCallInvariants {
  assertQty(i.qty);
  const shares = CONTRACT_MULTIPLIER * i.qty;
  const creditOnly = times(i.premium, shares);
  const callAwayGain = times(sub(i.strike, i.costBasis), shares);
  return {
    sharesCovered: shares,
    creditOnly,
    maxProfit: usd4(creditOnly + callAwayGain),
    lockedLoss: i.strike < i.costBasis,
    worstCase: sub(times(i.costBasis, shares), creditOnly),
  };
}

/** Basis written at assignment (SCR-034). Uses the ACTUAL fill premium, not the draft limit. */
export const assignmentCostBasis = (putStrike: Usd4, putFillPremium: Usd4) => sub(putStrike, putFillPremium);

function assertQty(qty: number) {
  if (!Number.isInteger(qty) || qty < 1) throw new RangeError("QTY_INVALID");
}
