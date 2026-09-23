// Minimal deterministic Monte Carlo core (docs/10). Seeded PRNG ⇒ same seed, same summary.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7) — adequate for an educational premium proxy.
function normCdf(x: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t
    * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export function bsPut(S: number, K: number, T: number, r: number, sigma: number) {
  if (T <= 0 || sigma <= 0) return Math.max(K - S, 0);
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
}

export interface McParams {
  quarterlyReturns: readonly number[]; paths: number; quarters: number; seed: number;
  otm: number; rf: number; iv: number; startCash: number; spot: number;
  maxContracts: number; fillCash: boolean;
}

export function runPutsOnlyMc(p: McParams) {
  const rnd = mulberry32(p.seed);
  const ending: number[] = [];
  for (let path = 0; path < p.paths; path++) {
    let cash = p.startCash, S = p.spot;
    for (let q = 0; q < p.quarters; q++) {
      const K = S * (1 - p.otm);
      const affordable = Math.floor(cash / (K * 100));
      const n = p.fillCash ? affordable : Math.min(p.maxContracts, affordable);
      const premium = bsPut(S, K, 0.25, p.rf, p.iv) * 100 * n;
      const R = p.quarterlyReturns[Math.floor(rnd() * p.quarterlyReturns.length)]!;
      const S1 = S * (1 + R);
      cash += premium + cash * p.rf * 0.25 - Math.max(K - S1, 0) * 100 * n;   // flatten at expiry
      S = S1;
    }
    ending.push(cash);
  }
  ending.sort((a, b) => a - b);
  const q = (x: number) => ending[Math.min(ending.length - 1, Math.floor(x * ending.length))]!;
  const cagr = (w: number) => Math.pow(w / p.startCash, 4 / p.quarters) - 1;
  return {
    wealth_p05: q(0.05), wealth_p50: q(0.5),
    cagr_p05: cagr(q(0.05)), cagr_p50: cagr(q(0.5)), cagr_p95: cagr(q(0.95)),
    p_below_start: ending.filter((w) => w < p.startCash).length / ending.length,
  };
}
