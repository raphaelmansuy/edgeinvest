import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import * as z from "zod";
import { daysToExpiry, exchangeDate } from "./calendar";
import { otmFraction } from "./envelope";
import { assignmentCostBasis, coveredCallInvariants, shortPutInvariants } from "./invariants";
import { runPutsOnlyMc } from "./mc";
import { isCentTick, parseUsd4, toDecimalString, usd4 } from "./money";
import { type DraftContext, evaluateDraft } from "./rules";
import { LEGAL_EDGES, phaseOf, transition } from "./wheel";

const $ = parseUsd4;

describe("money [EC-MN-*]", () => {
  test("[EC-MN-001] exact decimal round-trip, no float drift", () => {
    expect(toDecimalString($("0.1"))).toBe("0.1000");
    expect(toDecimalString(usd4($("0.1") + $("0.2")))).toBe("0.3000"); // 0.1 + 0.2 === 0.3 exactly
  });
  test("[EC-MN-002] rejects >4 dp, exponent, locale commas", () => {
    for (const bad of ["1.23456", "1e3", "1,000.00", "", "NaN", "--1"]) expect(() => $(bad)).toThrow("INVALID_MONEY");
  });
  test("[EC-MN-003] penny tick detection", () => {
    expect(isCentTick($("1.30"))).toBe(true);
    expect(isCentTick($("1.325"))).toBe(false); // a mid can be half-cent; a limit cannot
  });
});

describe("three numbers [US-1]", () => {
  test("[US-1] walkthrough example: 1 × QQQ 90 put @ 1.30", () => {
    const r = shortPutInvariants({ strike: $("90"), premium: $("1.30"), qty: 1 });
    expect([r.reserve, r.maxProfit, r.breakEven, r.worstCase].map(toDecimalString))
      .toEqual(["9000.0000", "130.0000", "88.7000", "8870.0000"]);
  });
  test("[US-1] Mobile article strike: 1 × QQQ 650 put @ 9.80", () => {
    const r = shortPutInvariants({ strike: $("650"), premium: $("9.80"), qty: 1 });
    expect(toDecimalString(r.reserve)).toBe("65000.0000");
    expect(toDecimalString(r.breakEven)).toBe("640.2000");
  });
  test("[EC-IV-001] property: worstCase = reserve − maxProfit, BE < strike, all exact", () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 2_000 }), fc.integer({ min: 1, max: 99 }), fc.integer({ min: 1, max: 10 }),
      (strikeDollars, premiumPctOfStrike, qty) => {
        const strike = usd4(strikeDollars * 10_000);
        const premium = usd4(Math.max(100, Math.floor(strike * premiumPctOfStrike / 100 / 100) * 100));
        fc.pre(premium < strike);
        const r = shortPutInvariants({ strike, premium, qty });
        return r.worstCase === r.reserve - r.maxProfit && r.breakEven < strike
          && Number.isSafeInteger(r.reserve) && r.reserve === strike * 100 * qty;
      }), { numRuns: 2_000 });
  });
  test("[EC-IV-002] impossible inputs refused, never coerced", () => {
    expect(() => shortPutInvariants({ strike: $("90"), premium: $("0"), qty: 1 })).toThrow("PREMIUM_NOT_POSITIVE");
    expect(() => shortPutInvariants({ strike: $("90"), premium: $("90"), qty: 1 })).toThrow("PREMIUM_GE_STRIKE");
    expect(() => shortPutInvariants({ strike: $("90"), premium: $("1"), qty: 0.5 })).toThrow("QTY_INVALID");
  });
});

describe("assignment & covered call [US-8]", () => {
  test("[US-8] basis = strike − ACTUAL fill premium", () => {
    expect(toDecimalString(assignmentCostBasis($("650"), $("9.62")))).toBe("640.3800");
  });
  test("[EC-WH-004] call strike below basis flags locked loss", () => {
    const cc = coveredCallInvariants({ strike: $("635"), premium: $("8.00"), qty: 1, costBasis: $("640.38") });
    expect(cc.lockedLoss).toBe(true);
    expect(toDecimalString(cc.maxProfit)).toBe("262.0000"); // 800 credit − 538 locked loss
  });
});

describe("calendar [EC-TM-001]", () => {
  test("HKT has rolled to the next day but New York has not: DTE uses ET", () => {
    const hkMorning = new Date("2026-09-24T07:00:00+08:00"); // = 2026-09-23 19:00 ET
    expect(exchangeDate(hkMorning)).toBe("2026-09-23");
    expect(daysToExpiry("2026-11-20", hkMorning)).toBe(58);
  });
  test("DST change (1 Nov 2026) does not shift day counts", () => {
    expect(daysToExpiry("2026-11-02", new Date("2026-10-31T16:00:00Z"))).toBe(2);
  });
});

describe("draft rules [US-4][US-5]", () => {
  const base: DraftContext = {
    draft: { side: "SELL", openClose: "open", putCall: "P", qty: 1, strike: $("650"), limitPrice: $("9.80"), orderType: "LMT", dte: 84 },
    spot: 721.11, envelopeId: "beginner_v1", phase: "cash-put", lotsOpen: 0, lotsMax: 1,
    settledCashUsd: $("100000"), fxLoan: false, optionsLevel: 3, packetComplete: true,
    costBasis: null, lockedLossAccepted: false, chainHasBidAsk: true,
  };
  test("happy path: Mobile article 650P (9.86% OTM, 84 DTE) is inside Beginner", () => {
    expect(otmFraction("P", 721.11, 650)).toBeCloseTo(0.0986, 4);
    expect(evaluateDraft(base)).toMatchObject({ status: "open", reasons: [] });
  });
  test.each([
    ["[EC-DR-001] BUY to open", { draft: { ...base.draft, side: "BUY" as const } }, "WRONG_SIDE"],
    ["[EC-DR-002] market order", { draft: { ...base.draft, orderType: "MKT" } }, "NOT_LIMIT"],
    ["[EC-WH-003] second lot", { lotsOpen: 1 }, "SECOND_LOT_WITHOUT_CASH"],
    ["[EC-CS-001] cash short of reserve", { settledCashUsd: $("64999.99") }, "CASH_NOT_SECURED"],
    ["[EC-CS-002] HKD loan", { fxLoan: true }, "FX_LOAN"],
    ["[EC-DR-004] Level 2 for a put", { optionsLevel: 2 }, "LEVEL_GAP"],
    ["[EC-PK-001] no crash+MC", { packetComplete: false }, "PACKET_INCOMPLETE"],
    ["[EC-MD-001] empty chain", { chainHasBidAsk: false }, "EMPTY_CHAIN"],
    ["[EC-EN-001] Mentor band with 9.9% OTM", { envelopeId: "mentor_cyrille_v1" as const }, "OTM_OUTSIDE_ENVELOPE"],
    ["[EC-WH-005] put while shares held", { phase: "shares-held" as const }, "PHASE_MISMATCH"],
  ])("%s ⇒ blocked", (_n, patch, reason) => {
    const r = evaluateDraft({ ...base, ...patch } as DraftContext);
    expect(r.status).toBe("blocked");
    expect(r.reasons).toContain(reason);
  });
  test("[EC-CS-003] exactly-funded reserve passes (boundary)", () => {
    expect(evaluateDraft({ ...base, settledCashUsd: $("65000") }).status).toBe("open");
  });
  test("[EC-WH-004] covered call under basis blocked until locked-loss accepted", () => {
    const cc: DraftContext = { ...base, phase: "shares-held", costBasis: $("640.38"),
      draft: { ...base.draft, putCall: "C", strike: $("635") }, spot: 600 };
    const blocked = evaluateDraft(cc);
    expect(blocked.reasons).toContain("LOCKED_LOSS_UNSIGNED");
    expect(evaluateDraft({ ...cc, lockedLossAccepted: true }).reasons).not.toContain("LOCKED_LOSS_UNSIGNED");
  });
});

describe("wheel state machine [US-8]", () => {
  test("full wheel: put → assigned → call → called away", () => {
    let s = "none" as Parameters<typeof transition>[0];
    for (const type of ["PUT_FILLED", "PUT_ASSIGNED", "CALL_FILLED", "CALLED_AWAY"] as const) {
      const t = transition(s, { type });
      if (!t.ok) throw new Error(t.error);
      s = t.to;
    }
    expect(s).toBe("closed");
  });
  test("[EC-WH-005] illegal edges rejected; phase derived", () => {
    expect(transition("shares_held", { type: "PUT_FILLED" })).toMatchObject({ ok: false, error: "ILLEGAL_TRANSITION" });
    expect(transition("closed", { type: "CALL_FILLED" }).ok).toBe(false);
    expect(phaseOf("shares_short_call")).toBe("shares-held");
  });
  test("[EC-DB-004] domain edges == DB allowed_transition seed (drift check)", () => {
    const db = new Set(["short_put_open>short_put_open", "short_put_open>closed", "short_put_open>shares_held",
      "shares_held>shares_short_call", "shares_held>closed", "shares_short_call>shares_held",
      "shares_short_call>shares_short_call", "shares_short_call>closed"]);
    const domain = new Set(LEGAL_EDGES.filter(([f]) => f !== "none").map(([f, t]) => `${f}>${t}`));
    expect(domain).toEqual(db);
  });
});

describe("Monte Carlo [US-3]", () => {
  const params = {
    quarterlyReturns: [0.08, 0.05, -0.12, 0.03, 0.10, -0.25, 0.07, 0.02, 0.06, -0.04],
    paths: 10_000, quarters: 20, seed: 20260828, otm: 0.10, rf: 0.037, iv: 0.22,
    startCash: 100_000, spot: 721.11, maxContracts: 1, fillCash: false,
  };
  test("[EC-SM-001] same seed ⇒ identical summary; different seed ⇒ different", () => {
    expect(runPutsOnlyMc(params)).toEqual(runPutsOnlyMc(params));
    expect(runPutsOnlyMc({ ...params, seed: 1 })).not.toEqual(runPutsOnlyMc(params));
  });
  test("[EC-SM-006] fill_cash widens the left tail vs one-lot default", () => {
    const oneLot = runPutsOnlyMc(params), maxed = runPutsOnlyMc({ ...params, fillCash: true });
    expect(maxed.wealth_p05).toBeLessThan(oneLot.wealth_p05);
  });
  test("perf budget: 10k × 20 quarters under 250 ms on the API box", () => {
    const t0 = performance.now(); runPutsOnlyMc(params);
    expect(performance.now() - t0).toBeLessThan(250);
  });
});

describe("agent tool schema single-source [DRY]", () => {
  test("Zod 4 schema → JSON Schema for Ollama tools[]", () => {
    const CalcInvariantsArgs = z.object({
      strike: z.number().positive().describe("Strike in USD"),
      premium: z.number().positive().describe("Premium per share in USD"),
      qty: z.number().int().min(1).max(10),
      put_call: z.enum(["P", "C"]),
    });
    const js = z.toJSONSchema(CalcInvariantsArgs) as any;
    expect(js.required).toEqual(["strike", "premium", "qty", "put_call"]);
    expect(js.properties.qty).toMatchObject({ type: "integer", minimum: 1, maximum: 10 });
    // A hallucinated tool call is re-validated server-side before execution:
    expect(CalcInvariantsArgs.safeParse({ strike: 650, premium: "9.8", qty: 1, put_call: "P" }).success).toBe(false);
  });
});
