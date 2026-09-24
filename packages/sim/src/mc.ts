// Monte Carlo csp-mc-bootstrap-q-v1 (docs/10 §6): bootstrapped quarterly returns, seeded, summary-only output.
import { bsCall, bsPut, mulberry32, quantile } from "./bs";

export const MC_MODEL_VERSION = "csp-mc-bootstrap-q-v1";
const M = 100;

export interface McParams {
  quarterlyReturns: readonly number[];
  paths: number;
  quarters: number;
  seed: number;
  otm: number;
  rf: number;
  iv: number;
  startCash: number;
  spot: number;
  maxContracts: number;
  fillCash: boolean;
  reserveEarnsRf?: boolean;
  wheel?: boolean;
}

export interface McSummary {
  cagr_p05: number;
  cagr_p50: number;
  cagr_p95: number;
  wealth_p05: number;
  wealth_p50: number;
  wealth_p95: number;
  p_below_start: number;
  median_max_dd: number;
  target_funded_rate: number;
  assignment_rate: number;
  fan: { q: number; p05: number; p25: number; p50: number; p75: number; p95: number }[];
  histogram: { lo: number; hi: number; count: number }[];
}

export function runPutsOnlyMc(p: McParams): McSummary {
  const rnd = mulberry32(p.seed);
  const earns = p.reserveEarnsRf ?? true;
  const ending = new Float64Array(p.paths);
  const byQuarter = Array.from({ length: p.quarters + 1 }, () => new Float64Array(p.paths));
  const mdds = new Float64Array(p.paths);
  let funded = 0;
  let assignments = 0;
  for (let path = 0; path < p.paths; path++) {
    let cash = p.startCash;
    let S = p.spot;
    let shares = 0;
    let basis = 0;
    let peak = cash;
    let mdd = 0;
    byQuarter[0]![path] = cash;
    for (let q = 0; q < p.quarters; q++) {
      const R = p.quarterlyReturns[Math.floor(rnd() * p.quarterlyReturns.length)]!;
      const S1 = S * (1 + R);
      if (shares === 0) {
        const K = S * (1 - p.otm);
        const affordable = Math.floor(cash / (K * M));
        const n = p.fillCash ? affordable : Math.min(p.maxContracts, affordable);
        const premium = bsPut(S, K, 0.25, p.rf, p.iv) * M * n;
        const interestBase = earns ? cash : cash - K * M * n;
        cash += premium + interestBase * p.rf * 0.25;
        if (S1 < K && n > 0) {
          assignments++;
          if (p.wheel) {
            shares = n * M;
            basis = K - premium / (M * n);
            cash -= K * M * n;
          } else cash -= (K - S1) * M * n; // flatten at expiry (prototype semantics)
        }
        if (cash >= K * M) funded++;
      } else {
        const Kc = Math.max(basis, S * 1.02);
        cash += bsCall(S, Kc, 0.25, p.rf, p.iv) * shares + cash * p.rf * 0.25;
        if (S1 > Kc) {
          cash += Kc * shares;
          shares = 0;
        }
      }
      S = S1;
      const wealth = cash + shares * S;
      byQuarter[q + 1]![path] = wealth;
      peak = Math.max(peak, wealth);
      mdd = Math.min(mdd, wealth / peak - 1);
    }
    ending[path] = cash + shares * S;
    mdds[path] = mdd;
  }
  const sorted = [...ending].sort((a, b) => a - b);
  const cagr = (w: number) => (w > 0 ? (w / p.startCash) ** (4 / p.quarters) - 1 : -1);
  const fan = byQuarter.map((col, q) => {
    const s = [...col].sort((a, b) => a - b);
    return { q, p05: quantile(s, 0.05), p25: quantile(s, 0.25), p50: quantile(s, 0.5), p75: quantile(s, 0.75), p95: quantile(s, 0.95) };
  });
  const lo = quantile(sorted, 0.005);
  const hi = quantile(sorted, 0.995);
  const bins = 24;
  const width = (hi - lo) / bins || 1;
  const histogram = Array.from({ length: bins }, (_, i) => ({ lo: lo + i * width, hi: lo + (i + 1) * width, count: 0 }));
  for (const w of sorted) histogram[Math.max(0, Math.min(bins - 1, Math.floor((w - lo) / width)))]!.count++;
  const w05 = quantile(sorted, 0.05);
  const w50 = quantile(sorted, 0.5);
  const w95 = quantile(sorted, 0.95);
  return {
    cagr_p05: cagr(w05), cagr_p50: cagr(w50), cagr_p95: cagr(w95),
    wealth_p05: w05, wealth_p50: w50, wealth_p95: w95,
    p_below_start: sorted.filter((w) => w < p.startCash).length / p.paths,
    median_max_dd: quantile([...mdds].sort((a, b) => a - b), 0.5),
    target_funded_rate: funded / (p.paths * p.quarters),
    assignment_rate: assignments / (p.paths * p.quarters),
    fan, histogram,
  };
}
