// Crash replay (crash-lib-v1, docs/10 §5): one scenario, weekly marks, CSP (one lot | fill_cash) vs T-bill vs buy-and-hold.
import { bsCall, bsPut, maxDrawdown, roundCents, roundStrikeDown, roundStrikeUp } from "./bs";
import type { CrashScenario } from "./datasets";

export const CRASH_MODEL_VERSION = "crash-lib-v1";
const M = 100;
const WEEKS_PER_CYCLE = 13; // ~3-month contracts, rolled at expiry

export interface CrashParams {
  otm: number; // put OTM fraction (inside envelope band)
  startCash: number;
  maxContracts: number;
  fillCash: boolean;
  wheel: boolean;
  reserveEarnsRf: boolean;
  /** Rescale the path so week 0 equals today's spot: the crash's returns applied to today's lot size. */
  scaleToSpot?: number;
}

export interface CrashEvent { week: number; date: string; kind: "sell_put" | "put_expired" | "assigned" | "sell_call" | "call_expired" | "called_away"; strike: number; premium: number; lots: number; spot: number }

export interface StrategyPath { key: "tbill" | "buy_hold" | "csp_one_lot" | "csp_fill_cash"; label: string; wealth: number[] }

export interface CrashResult {
  scenario: { id: string; title: string; start: string; end: string; iv_source: string[] };
  dates: string[];
  spot: number[];
  paths: StrategyPath[];
  events: CrashEvent[]; // for the selected sizing (fill_cash or one lot)
  summary: Record<StrategyPath["key"], { end: number; min: number; max_dd: number; ret: number }>;
  assigned: { week: number; date: string; basis: number } | null;
  weeks_under_water: number;
}

function simulateCsp(s: CrashScenario, p: CrashParams, fillCash: boolean) {
  const closes = s.weekly_close;
  const rfW = p.reserveEarnsRf ? s.rf / 52 : 0;
  let cash = p.startCash;
  let shares = 0;
  let basis = 0;
  let pos: { type: "put" | "call"; strike: number; lots: number; startWeek: number } | null = null;
  const wealth: number[] = [];
  const events: CrashEvent[] = [];
  let assigned: CrashResult["assigned"] = null;
  const ev = (week: number, kind: CrashEvent["kind"], strike: number, premium: number, lots: number) =>
    events.push({ week, date: s.weekly_dates[week]!, kind, strike, premium, lots, spot: closes[week]! });

  for (let w = 0; w < closes.length; w++) {
    const S = closes[w]!;
    const iv = s.iv_path[w]!;
    if (w > 0) cash *= 1 + rfW;
    if (pos && w - pos.startWeek >= WEEKS_PER_CYCLE) {
      if (pos.type === "put") {
        if (S < pos.strike) {
          shares += pos.lots * M;
          cash -= pos.strike * M * pos.lots;
          basis = pos.strike - (events.findLast((e) => e.kind === "sell_put")?.premium ?? 0);
          ev(w, "assigned", pos.strike, 0, pos.lots);
          assigned ??= { week: w, date: s.weekly_dates[w]!, basis: roundCents(basis) };
        } else ev(w, "put_expired", pos.strike, 0, pos.lots);
      } else if (S > pos.strike) {
        cash += pos.strike * M * pos.lots;
        shares -= pos.lots * M;
        ev(w, "called_away", pos.strike, 0, pos.lots);
      } else ev(w, "call_expired", pos.strike, 0, pos.lots);
      pos = null;
    }
    const remaining = closes.length - 1 - w;
    if (!pos && remaining >= WEEKS_PER_CYCLE) {
      if (shares === 0) {
        const K = roundStrikeDown(S * (1 - p.otm));
        const affordable = Math.floor(cash / (K * M));
        const lots = fillCash ? affordable : Math.min(p.maxContracts, affordable);
        if (lots > 0) {
          const prem = roundCents(bsPut(S, K, 0.25, s.rf, iv));
          cash += prem * M * lots;
          pos = { type: "put", strike: K, lots, startWeek: w };
          ev(w, "sell_put", K, prem, lots);
        }
      } else if (p.wheel) {
        const K = roundStrikeUp(Math.max(basis, S * 1.02));
        const lots = shares / M;
        const prem = roundCents(bsCall(S, K, 0.25, s.rf, iv));
        cash += prem * M * lots;
        pos = { type: "call", strike: K, lots, startWeek: w };
        ev(w, "sell_call", K, prem, lots);
      }
    }
    const T = pos ? Math.max(0, (WEEKS_PER_CYCLE - (w - pos.startWeek)) / 52) : 0;
    const liability = !pos ? 0 : pos.type === "put"
      ? bsPut(S, pos.strike, T, s.rf, iv) * M * pos.lots
      : bsCall(S, pos.strike, T, s.rf, iv) * M * pos.lots;
    wealth.push(cash + shares * S - liability);
  }
  return { wealth, events, assigned };
}

export function replayCrash(raw: CrashScenario, p: CrashParams): CrashResult {
  const k = p.scaleToSpot ? p.scaleToSpot / raw.weekly_close[0]! : 1;
  const s: CrashScenario = k === 1 ? raw : { ...raw, weekly_close: raw.weekly_close.map((c) => Math.round(c * k * 100) / 100) };
  const closes = s.weekly_close;
  const tbill = closes.map((_, w) => p.startCash * (1 + s.rf / 52) ** w);
  const bh = closes.map((c) => (p.startCash / closes[0]!) * c);
  const one = simulateCsp(s, p, false);
  const max = simulateCsp(s, p, true);
  const paths: StrategyPath[] = [
    { key: "tbill", label: "T-bill only", wealth: tbill },
    { key: "buy_hold", label: "Buy & hold QQQ", wealth: bh },
    { key: "csp_one_lot", label: "Cash-secured put · one lot", wealth: one.wealth },
    { key: "csp_fill_cash", label: "Cash-secured put · fill cash", wealth: max.wealth },
  ];
  const summary = Object.fromEntries(paths.map((x) => [x.key, {
    end: x.wealth.at(-1)!, min: Math.min(...x.wealth), max_dd: maxDrawdown(x.wealth), ret: x.wealth.at(-1)! / p.startCash - 1,
  }])) as CrashResult["summary"];
  const chosen = p.fillCash ? max : one;
  return {
    scenario: { id: s.id, title: s.title, start: s.start, end: s.end, iv_source: s.iv_source },
    dates: s.weekly_dates, spot: closes, paths, events: chosen.events, summary, assigned: chosen.assigned,
    weeks_under_water: chosen.wealth.filter((v) => v < p.startCash).length,
  };
}
