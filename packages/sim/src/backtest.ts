// Backtest csp-backtest-bsproxy-v1 (docs/10 §7): quarterly decisions on monthly history using the SAME
// envelope/hurdle/lots rules as real drafts. Premium = BS proxy with VXN IV ⇒ claim label "unconfirmed".
import { bsCall, bsPut, maxDrawdown, roundCents, roundStrikeDown, roundStrikeUp } from "./bs";

export const BACKTEST_MODEL_VERSION = "csp-backtest-bsproxy-v1";
const M = 100;

export interface BacktestSeries { dates: string[]; close: number[]; iv: number[]; rf: number[] }
export interface BacktestParams { otm: number; startCash: number; maxContracts: number; start: string; end: string; wheel: boolean }

type Decision = { date: string; action: "sell_put" | "sell_call" | "skip"; reason?: string; strike?: number; premium?: number };

export interface BacktestResult {
  dates: string[];
  wealth: number[];
  fully_secured: number[]; // CBOE PUT-style benchmark: all cash secures fractional contracts
  buy_hold: number[];
  tbill: number[];
  decisions: Decision[];
  metrics: {
    cagr: number; vol: number; max_dd: number; assignment_rate: number; pct_below_rf: number;
    skip_reasons: Record<string, number>; bh_cagr: number; tbill_cagr: number; fs_cagr: number; fs_max_dd: number; cycles: number;
  };
}

function walk(data: BacktestSeries, idx: number[], p: BacktestParams, fractional: boolean) {
  let cash = p.startCash;
  let shares = 0;
  let basis = 0;
  let pos: { type: "put" | "call"; strike: number; lots: number; expiresAt: number } | null = null;
  const wealth: number[] = [];
  const decisions: Decision[] = [];
  const skip: Record<string, number> = {};
  let cycles = 0;
  let assigned = 0;
  let belowRf = 0;
  idx.forEach((i, k) => {
    const S = data.close[i]!;
    const rf = data.rf[i]!;
    const iv = data.iv[i]!;
    if (k > 0) cash *= 1 + data.rf[idx[k - 1]!]! / 12;
    if (pos && k >= pos.expiresAt) {
      if (pos.type === "put" && S < pos.strike) {
        shares += pos.lots * M;
        cash -= pos.strike * M * pos.lots;
        basis = pos.strike - (decisions.findLast((d) => d.action === "sell_put")?.premium ?? 0);
        assigned++;
      } else if (pos.type === "call" && S > pos.strike) {
        cash += pos.strike * M * pos.lots;
        shares = 0;
      }
      pos = null;
    }
    const date = data.dates[i]!;
    if (!pos && k + 3 < idx.length) {
      if (shares === 0) {
        cycles++;
        const K = roundStrikeDown(S * (1 - p.otm));
        const prem = roundCents(bsPut(S, K, 0.25, rf, iv));
        const yieldAnn = (prem / K) * 4;
        const lots = fractional ? cash / (K * M) : Math.min(p.maxContracts, Math.floor(cash / (K * M)));
        if (yieldAnn < rf) belowRf++;
        const reason = lots < (fractional ? 1e-9 : 1) ? "cash_not_secured"
          : yieldAnn < rf ? "premium_below_tbill" : prem < 0.05 ? "no_bid" : null;
        if (reason) {
          skip[reason] = (skip[reason] ?? 0) + 1;
          decisions.push({ date, action: "skip", reason });
        } else {
          cash += prem * M * lots;
          pos = { type: "put", strike: K, lots, expiresAt: k + 3 };
          decisions.push({ date, action: "sell_put", strike: K, premium: prem });
        }
      } else if (p.wheel) {
        const K = roundStrikeUp(Math.max(basis, S * 1.02));
        const prem = roundCents(bsCall(S, K, 0.25, rf, iv));
        cash += prem * shares;
        pos = { type: "call", strike: K, lots: shares / M, expiresAt: k + 3 };
        decisions.push({ date, action: "sell_call", strike: K, premium: prem });
      }
    }
    const T = pos ? (pos.expiresAt - k) / 12 : 0;
    const liability = !pos ? 0 : pos.type === "put"
      ? bsPut(S, pos.strike, T, rf, iv) * M * pos.lots
      : bsCall(S, pos.strike, T, rf, iv) * M * pos.lots;
    wealth.push(cash + shares * S - liability);
  });
  return { wealth, decisions, skip, cycles, assigned, belowRf };
}

export function runBacktest(data: BacktestSeries, p: BacktestParams, onProgress?: (f: number) => void): BacktestResult {
  const idx = data.dates.map((d, i) => [d, i] as const).filter(([d]) => d >= p.start && d <= p.end).map(([, i]) => i);
  if (idx.length < 6) throw new RangeError("BACKTEST_WINDOW_TOO_SHORT");
  const main = walk(data, idx, p, false);
  onProgress?.(0.5);
  const fs = walk(data, idx, p, true);
  const years = idx.length / 12;
  const cagrOf = (xs: number[]) => (xs.at(-1)! / p.startCash) ** (1 / years) - 1;
  const rets = main.wealth.slice(1).map((w, j) => w / main.wealth[j]! - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const vol = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rets.length - 1)) * Math.sqrt(12);
  const s0 = data.close[idx[0]!]!;
  const buyHold = idx.map((i) => (p.startCash / s0) * data.close[i]!);
  const tbill: number[] = [];
  idx.forEach((_, k) => tbill.push(k === 0 ? p.startCash : tbill[k - 1]! * (1 + data.rf[idx[k - 1]!]! / 12)));
  onProgress?.(1);
  return {
    dates: idx.map((i) => data.dates[i]!), wealth: main.wealth, fully_secured: fs.wealth, buy_hold: buyHold, tbill,
    decisions: main.decisions,
    metrics: {
      cagr: cagrOf(main.wealth), vol, max_dd: maxDrawdown(main.wealth),
      assignment_rate: main.cycles ? main.assigned / main.cycles : 0, pct_below_rf: main.cycles ? main.belowRf / main.cycles : 0,
      skip_reasons: main.skip, bh_cagr: cagrOf(buyHold), tbill_cagr: cagrOf(tbill),
      fs_cagr: cagrOf(fs.wealth), fs_max_dd: maxDrawdown(fs.wealth), cycles: main.cycles,
    },
  };
}
