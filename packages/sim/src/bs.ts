// Black-Scholes premium proxy (educational; disclosed as a proxy, docs/10 §7). No dividends.
// The unseeded global RNG is banned in this package (test-enforced); seeded runs use domain mulberry32.
export { mulberry32 } from "@edge/domain";

/** Standard normal CDF via erfc (W. J. Cody rational approximation, |rel err| < 1.2e-7). Symmetric by construction. */
export function normCdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * z);
  const erfc = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806
    + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? 1 - erfc / 2 : erfc / 2;
}

function d12(S: number, K: number, T: number, r: number, sigma: number) {
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  return [d1, d1 - sigma * Math.sqrt(T)] as const;
}

export function bsPut(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0 || sigma <= 0) return Math.max(K * Math.exp(-r * Math.max(T, 0)) - S, 0);
  const [d1, d2] = d12(S, K, T, r, sigma);
  return K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
}

export function bsCall(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0 || sigma <= 0) return Math.max(S - K * Math.exp(-r * Math.max(T, 0)), 0);
  const [d1, d2] = d12(S, K, T, r, sigma);
  return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
}

/** Listed QQQ strikes are $1 apart; premiums quote in cents. */
export const roundStrikeDown = (k: number) => Math.floor(k);
export const roundStrikeUp = (k: number) => Math.ceil(k);
export const roundCents = (p: number) => Math.round(p * 100) / 100;

export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export function maxDrawdown(series: readonly number[]): number {
  let peak = -Infinity;
  let mdd = 0;
  for (const v of series) {
    peak = Math.max(peak, v);
    if (peak > 0) mdd = Math.min(mdd, v / peak - 1);
  }
  return mdd;
}
