// Payoff at expiry (payoff-v1). Grid always contains 0, break-even, strike and spot (docs/10 §4).
export interface PayoffPoint { s: number; pnl: number }
export type PayoffInput =
  | { kind: "put"; strike: number; premium: number; qty: number; spot: number }
  | { kind: "call"; strike: number; premium: number; qty: number; spot: number; basis: number };

const M = 100;

export function pnlAt(i: PayoffInput, s: number): number {
  if (i.kind === "put") return (i.premium - Math.max(i.strike - s, 0)) * M * i.qty;
  return (i.premium + Math.min(s, i.strike) - i.basis) * M * i.qty;
}

export function breakEvenOf(i: PayoffInput): number {
  return i.kind === "put" ? i.strike - i.premium : i.basis - i.premium;
}

export function payoffGrid(i: PayoffInput, points = 120): PayoffPoint[] {
  const hi = Math.max(i.spot, i.strike) * 1.35;
  const anchors = [0, breakEvenOf(i), i.strike, i.spot, ...(i.kind === "call" ? [i.basis] : [])];
  const xs = new Set<number>(anchors.map((x) => Math.round(x * 100) / 100));
  for (let k = 0; k <= points; k++) xs.add(Math.round(((hi * k) / points) * 100) / 100);
  return [...xs].filter((x) => x >= 0).sort((a, b) => a - b).map((s) => ({ s, pnl: pnlAt(i, s) }));
}
