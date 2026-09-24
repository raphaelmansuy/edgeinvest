import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import {
  bsCall, bsPut, CRASH_SCENARIOS, MANIFEST, MONTHLY, payoffGrid, pnlAt, QUARTERLY, replayCrash, runBacktest, runPutsOnlyMc,
} from "../src";

describe("Black-Scholes proxy [EC-SM-002]", () => {
  test("put-call parity C − P = S − K·e^{−rT} within 1e-6", () => {
    fc.assert(fc.property(
      fc.double({ min: 50, max: 900, noNaN: true }), fc.double({ min: 0.6, max: 1.4, noNaN: true }),
      fc.double({ min: 0.02, max: 2, noNaN: true }), fc.double({ min: 0, max: 0.08, noNaN: true }),
      fc.double({ min: 0.05, max: 1.2, noNaN: true }),
      (S, m, T, r, v) => {
        const K = S * m;
        return Math.abs(bsCall(S, K, T, r, v) - bsPut(S, K, T, r, v) - (S - K * Math.exp(-r * T))) < 1e-6 * S;
      }), { numRuns: 1_000 });
  });
  test("bounds, σ→0 intrinsic, monotonicity in OTM, T and σ", () => {
    const P = bsPut(700, 650, 0.25, 0.04, 0.22);
    expect(P).toBeGreaterThan(0);
    expect(P).toBeLessThan(650 * Math.exp(-0.04 * 0.25));
    expect(bsPut(600, 650, 0.25, 0, 0)).toBeCloseTo(50, 9);
    expect(bsPut(700, 620, 0.25, 0.04, 0.22)).toBeLessThan(P);
    expect(bsPut(700, 650, 0.5, 0.04, 0.22)).toBeGreaterThan(P);
    expect(bsPut(700, 650, 0.25, 0.04, 0.3)).toBeGreaterThan(P);
  });
});

describe("payoff [EC-IV-001]", () => {
  test("grid includes anchors; pnl(0) = −worst case, pnl(BE) = 0", () => {
    const i = { kind: "put" as const, strike: 650, premium: 9.8, qty: 1, spot: 721.11 };
    const g = payoffGrid(i);
    for (const x of [0, 640.2, 650, 721.11]) expect(g.some((p) => p.s === x)).toBe(true);
    expect(pnlAt(i, 0)).toBeCloseTo(-64_020, 6);
    expect(pnlAt(i, 640.2)).toBeCloseTo(0, 6);
    expect(pnlAt(i, 800)).toBeCloseTo(980, 6);
  });
  test("covered call caps upside at Kc", () => {
    const i = { kind: "call" as const, strike: 700, premium: 8, qty: 1, spot: 680, basis: 640.38 };
    expect(pnlAt(i, 900)).toBeCloseTo(6_762, 6);
  });
});

const mc = {
  quarterlyReturns: QUARTERLY.returns, paths: 10_000, quarters: 20, seed: 20260828, otm: 0.085, rf: 0.0378, iv: 0.22,
  startCash: 100_000, spot: 721.11, maxContracts: 1, fillCash: false,
};

describe("Monte Carlo [US-3]", () => {
  test("[EC-SM-001] same seed ⇒ identical summary; different seed ⇒ different", () => {
    expect(runPutsOnlyMc(mc)).toEqual(runPutsOnlyMc(mc));
    expect(runPutsOnlyMc({ ...mc, seed: 1 }).wealth_p50).not.toBe(runPutsOnlyMc(mc).wealth_p50);
  });
  test("[EC-SM-006] fill_cash widens the left tail vs one-lot default", () => {
    expect(runPutsOnlyMc({ ...mc, fillCash: true, startCash: 400_000 }).cagr_p05)
      .toBeLessThan(runPutsOnlyMc({ ...mc, startCash: 400_000 }).cagr_p05);
  });
  test("[EC-SM-004] zero-variance returns ⇒ deterministic ledger", () => {
    const flat = runPutsOnlyMc({ ...mc, quarterlyReturns: [0.02], paths: 200, quarters: 4 });
    expect(flat.wealth_p05).toBeCloseTo(flat.wealth_p95, 6);
    expect(flat.p_below_start).toBe(0);
  });
  test("fan and histogram shapes", () => {
    const r = runPutsOnlyMc({ ...mc, paths: 2_000 });
    expect(r.fan).toHaveLength(21);
    expect(r.fan.every((f) => f.p05 <= f.p50 && f.p50 <= f.p95)).toBe(true);
    expect(r.histogram.reduce((a, b) => a + b.count, 0)).toBe(2_000);
  });
  test("[EC-SM-003] perf budget: 10k × 20 quarters under 250 ms", () => {
    const t0 = performance.now();
    runPutsOnlyMc(mc);
    expect(performance.now() - t0).toBeLessThan(250);
  });
});

describe("crash replay [US-3]", () => {
  const params = { otm: 0.085, startCash: 100_000, maxContracts: 1, fillCash: false, wheel: true, reserveEarnsRf: true };
  test("[EC-SM-006] dotcom_2000 at today's lot size: fill_cash is worse than one lot", () => {
    const r = replayCrash(CRASH_SCENARIOS.dotcom_2000!, { ...params, startCash: 250_000, scaleToSpot: 721.11 });
    expect(r.spot[0]).toBe(721.11);
    expect(r.events[0]!.strike).toBe(659);
    expect(r.summary.csp_fill_cash.max_dd).toBeLessThan(r.summary.csp_one_lot.max_dd);
    expect(r.summary.csp_fill_cash.min).toBeLessThan(r.summary.csp_one_lot.min);
    expect(r.summary.buy_hold.max_dd).toBeLessThan(-0.7);
    expect(r.assigned).not.toBeNull();
  });
  test("every scenario replays with aligned series and a logged first sale", () => {
    for (const s of Object.values(CRASH_SCENARIOS)) {
      const r = replayCrash(s, params);
      expect(r.paths.every((p) => p.wealth.length === s.weekly_close.length)).toBe(true);
      expect(r.events[0]!.kind).toBe("sell_put");
    }
  });
});

describe("backtest [US-3]", () => {
  test("runs over 2010–2026 with metrics and progress", () => {
    const seen: number[] = [];
    const r = runBacktest(MONTHLY, { otm: 0.085, startCash: 100_000, maxContracts: 1, start: "2010-01-01", end: "2026-08-31", wheel: true },
      (f) => seen.push(f));
    expect(r.wealth.length).toBe(r.dates.length);
    expect(r.metrics.cycles).toBeGreaterThan(20);
    expect(r.metrics.max_dd).toBeLessThanOrEqual(0);
    expect(seen.at(-1)).toBe(1);
  });
});

describe("datasets [EC-SM-008]", () => {
  test("every data file matches its manifest sha256", () => {
    for (const [name, f] of Object.entries(MANIFEST.files)) {
      const bytes = readFileSync(join(import.meta.dir, "../data", name));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe((f as { sha256: string }).sha256);
    }
  });
  test("Math.random is banned in packages/sim", () => {
    for (const f of ["bs", "crash", "mc", "backtest", "payoff"]) {
      expect(readFileSync(join(import.meta.dir, `../src/${f}.ts`), "utf8")).not.toContain("Math.random");
    }
  });
});
