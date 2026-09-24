import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
  annualise, assignmentCostBasis, cashPosition, coveredCallInvariants, type DraftContext, daysToExpiry,
  decisionBasis, ENVELOPES, envelopeParamsCanonical, evaluateDraft, exchangeDate, formatUsd, hkYearOfAssessment,
  isCentTick, isRegularSession, LEGAL_EDGES, otmFraction, parseUsd4, phaseOf, premiumYieldAnn, quarterLabel,
  quoteIsStale, REASON_TEXT, DRAFT_RULES, scoreCandidates, shortPutInvariants, toDecimalString, transition, usd4,
} from "../src";

const $ = parseUsd4;

describe("money [EC-MN-*]", () => {
  test("[EC-MN-001] exact decimal round-trip, no float drift", () => {
    expect(toDecimalString($("0.1"))).toBe("0.1000");
    expect(toDecimalString(usd4($("0.1") + $("0.2")))).toBe("0.3000");
  });
  test("[EC-MN-002] rejects >4 dp, exponent, locale commas", () => {
    for (const bad of ["1.23456", "1e3", "1,000.00", "", "NaN", "--1", ".5"]) expect(() => $(bad)).toThrow("INVALID_MONEY");
  });
  test("[EC-MN-002] property: parse(format(x)) == x", () => {
    fc.assert(fc.property(fc.integer({ min: -1e12, max: 1e12 }), (u) => $(toDecimalString(usd4(u))) === usd4(u)));
  });
  test("[EC-MN-003] penny tick detection", () => {
    expect(isCentTick($("1.30"))).toBe(true);
    expect(isCentTick($("1.325"))).toBe(false);
  });
  test("display formatter groups and signs", () => {
    expect(formatUsd($("65000"))).toBe("65,000.00");
    expect(formatUsd($("-8870"))).toBe("−8,870.00");
    expect(formatUsd($("130"), { sign: true })).toBe("+130.00");
    expect(() => usd4(2 ** 60)).toThrow("UNSAFE_MONEY");
  });
});

describe("five numbers [US-1]", () => {
  test("[US-1] Example A: 1 × QQQ 90 put @ 1.30", () => {
    const r = shortPutInvariants({ strike: $("90"), premium: $("1.30"), qty: 1 });
    expect([r.reserve, r.maxProfit, r.breakEven, r.worstCase].map(toDecimalString))
      .toEqual(["9000.0000", "130.0000", "88.7000", "8870.0000"]);
  });
  test("[US-1] Example B: 1 × QQQ 650 put @ 9.80", () => {
    const r = shortPutInvariants({ strike: $("650"), premium: $("9.80"), qty: 1 });
    expect(toDecimalString(r.reserve)).toBe("65000.0000");
    expect(toDecimalString(r.breakEven)).toBe("640.2000");
    expect(toDecimalString(r.worstCase)).toBe("64020.0000");
  });
  test("[EC-IV-001][EC-IV-002][EC-IV-003] properties: identity, linearity, bound", () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 2_000 }), fc.integer({ min: 1, max: 99 }), fc.integer({ min: 1, max: 10 }),
      (strikeDollars, pct, qty) => {
        const strike = usd4(strikeDollars * 10_000);
        const premium = usd4(Math.max(100, Math.floor((strike * pct) / 100 / 100) * 100));
        fc.pre(premium < strike);
        const r = shortPutInvariants({ strike, premium, qty });
        const one = shortPutInvariants({ strike, premium, qty: 1 });
        return r.worstCase === r.reserve - r.maxProfit && r.breakEven > 0 && r.breakEven < strike
          && r.reserve === one.reserve * qty;
      }), { numRuns: 2_000 });
  });
  test("[EC-IV-002] impossible inputs refused, never coerced", () => {
    expect(() => shortPutInvariants({ strike: $("90"), premium: $("0"), qty: 1 })).toThrow("PREMIUM_NOT_POSITIVE");
    expect(() => shortPutInvariants({ strike: $("90"), premium: $("90"), qty: 1 })).toThrow("PREMIUM_GE_STRIKE");
    expect(() => shortPutInvariants({ strike: $("90"), premium: $("1"), qty: 0.5 })).toThrow("QTY_INVALID");
  });
});

describe("assignment & covered call [US-8]", () => {
  test("[US-8] basis = strike − ACTUAL fill premium (Example B fill 9.62)", () => {
    expect(toDecimalString(assignmentCostBasis($("650"), $("9.62")))).toBe("640.3800");
  });
  test("[EC-WH-009] decision basis nets rolls: credits − buy-to-close debits", () => {
    expect(toDecimalString(decisionBasis($("650"), [$("962")], [], 1))).toBe("640.3800");
    expect(toDecimalString(decisionBasis($("650"), [$("962"), $("700")], [$("-400")], 1))).toBe("637.3800");
  });
  test("[US-8] Example C: 700 C @ 8.00 with basis 640.38", () => {
    const cc = coveredCallInvariants({ strike: $("700"), premium: $("8.00"), qty: 1, costBasis: $("640.38") });
    expect(toDecimalString(cc.maxProfit)).toBe("6762.0000");
    expect(toDecimalString(cc.worstCase)).toBe("63238.0000");
    expect(cc.lockedLoss).toBe(false);
  });
  test("[EC-IV-004] locked loss ⇔ Kc < B, and then max profit < credit", () => {
    const cc = coveredCallInvariants({ strike: $("635"), premium: $("8.00"), qty: 1, costBasis: $("640.38") });
    expect(cc.lockedLoss).toBe(true);
    expect(cc.maxProfit).toBeLessThan(cc.creditOnly);
    expect(toDecimalString(cc.maxProfit)).toBe("262.0000");
  });
});

describe("calendar [EC-TM-*]", () => {
  test("[EC-TM-001] Example D: HKT rolled over, New York has not; DTE uses ET", () => {
    const hkMorning = new Date("2026-09-24T07:00:00+08:00");
    expect(exchangeDate(hkMorning)).toBe("2026-09-23");
    expect(daysToExpiry("2026-11-20", hkMorning)).toBe(58);
  });
  test("[EC-TM-002] DST change (1 Nov 2026) does not shift day counts", () => {
    expect(daysToExpiry("2026-11-02", new Date("2026-10-31T16:00:00Z"))).toBe(2);
  });
  test("[EC-MD-002] session detection across DST and holidays", () => {
    expect(isRegularSession(new Date("2026-08-28T14:00:00Z"))).toBe(true); // 10:00 EDT Fri
    expect(isRegularSession(new Date("2026-12-01T14:00:00Z"))).toBe(false); // 09:00 EST
    expect(isRegularSession(new Date("2026-12-01T15:00:00Z"))).toBe(true); // 10:00 EST
    expect(isRegularSession(new Date("2026-09-07T15:00:00Z"))).toBe(false); // Labor Day
    expect(isRegularSession(new Date("2026-08-29T15:00:00Z"))).toBe(false); // Saturday
  });
  test("[EC-MD-002] staleness: 15 min in session, since last close outside", () => {
    const inSession = new Date("2026-08-28T15:00:00Z");
    expect(quoteIsStale(new Date(inSession.getTime() - 10 * 60_000), inSession)).toBe(false);
    expect(quoteIsStale(new Date(inSession.getTime() - 16 * 60_000), inSession)).toBe(true);
    const saturday = new Date("2026-08-29T15:00:00Z");
    expect(quoteIsStale(new Date("2026-08-28T19:55:00Z"), saturday)).toBe(false); // captured at Fri close
    expect(quoteIsStale(new Date("2026-08-27T19:55:00Z"), saturday)).toBe(true);
  });
  test("[EC-LG-003] HK year of assessment and quarter labels", () => {
    expect(hkYearOfAssessment("2026-03-31")).toBe("2025/26");
    expect(hkYearOfAssessment("2026-04-01")).toBe("2026/27");
    expect(quarterLabel("2026-11-20")).toBe("2026-Q4");
  });
});

describe("envelopes [EC-EN-*]", () => {
  test("[EC-EN-002] bands are inclusive and leave the 12–16 % gap", () => {
    expect(ENVELOPES.beginner_v1).toMatchObject({ otmMin: 0.05, otmMax: 0.12, lotsMax: 1 });
    expect(ENVELOPES.mentor_cyrille_v1).toMatchObject({ otmMin: 0.16, otmMax: 0.3, requiresMastery: true });
    expect(envelopeParamsCanonical(ENVELOPES.beginner_v1)).toContain('"otm_min":0.05');
  });
});

const NOW = new Date("2026-08-28T15:00:00Z"); // Fri 11:00 EDT, in session
const base: DraftContext = {
  now: NOW,
  draft: { underlying: "QQQ", side: "SELL", openClose: "open", putCall: "P", qty: 1, strike: $("650"),
    expiry: "2026-11-20", limitPrice: $("9.80"), orderType: "LMT" },
  quote: { bid: $("9.80"), ask: $("10.00"), asOf: new Date(NOW.getTime() - 5 * 60_000) },
  spot: 721.11, envelopeId: "beginner_v1", phase: "cash-put", lotsOpen: 0, lotsMax: 1,
  settledCashUsd: $("100000"), reservedOpenUsd: $("0"), fxLoan: false, optionsLevel: 3,
  accountAsOf: new Date(NOW.getTime() - 3_600_000), packet: { hasCrash: true, hasMc: true },
  costBasis: null, lockedLossAccepted: false, haltReason: null, mode: "paper", liveEligible: false, exDividendDate: null,
};

describe("draft rules [US-4][US-5]", () => {
  test("happy path: Example B 650P (9.86 % OTM, 84 DTE) is inside Beginner", () => {
    expect(otmFraction("P", 721.11, 650)).toBeCloseTo(0.0986, 4);
    expect(daysToExpiry("2026-11-20", NOW)).toBe(84);
    expect(evaluateDraft(base)).toMatchObject({ status: "open", reasons: [], warnings: [], haltsToRaise: [] });
  });
  test.each([
    ["[EC-DR-001] BUY to open", { draft: { ...base.draft, side: "BUY" as const } }, "WRONG_SIDE"],
    ["[EC-DR-002] market order", { draft: { ...base.draft, orderType: "MKT" } }, "NOT_LIMIT"],
    ["[EC-DR-003] off tick", { draft: { ...base.draft, limitPrice: $("9.805") } }, "OFF_TICK"],
    ["[EC-DR-006] non-allowlisted", { draft: { ...base.draft, underlying: "TSLA" } }, "NOT_ALLOWLISTED"],
    ["[EC-WH-003] second lot", { lotsOpen: 1 }, "SECOND_LOT_WITHOUT_CASH"],
    ["[EC-CS-001] cash short of reserve", { settledCashUsd: $("64999.99") }, "CASH_NOT_SECURED"],
    ["[EC-CS-004] open reserves counted", { settledCashUsd: $("100000"), reservedOpenUsd: $("40000") }, "CASH_NOT_SECURED"],
    ["[EC-CS-002] HKD loan", { fxLoan: true }, "FX_LOAN"],
    ["[EC-DR-004] Level 2 for a put", { optionsLevel: 2 }, "LEVEL_GAP"],
    ["[EC-PK-001] no MC", { packet: { hasCrash: true, hasMc: false } }, "PACKET_INCOMPLETE"],
    ["[EC-MD-001] empty chain", { quote: null }, "EMPTY_CHAIN"],
    ["[EC-MD-007] non-standard deliverable", { quote: { ...base.quote!, nonStandard: true } }, "EMPTY_CHAIN"],
    ["[EC-MD-002] stale chain", { quote: { ...base.quote!, asOf: new Date(NOW.getTime() - 20 * 60_000) } }, "CHAIN_STALE"],
    ["[EC-CS-005] stale account snapshot", { accountAsOf: new Date(NOW.getTime() - 25 * 3_600_000) }, "STALE_ACCOUNT_SNAPSHOT"],
    ["[EC-EN-001] Mentor band with 9.9 % OTM", { envelopeId: "mentor_cyrille_v1" as const }, "OTM_OUTSIDE_ENVELOPE"],
    ["[EC-EN-001] DTE 30", { draft: { ...base.draft, expiry: "2026-09-27" } }, "DTE_OUTSIDE_ENVELOPE"],
    ["[EC-WH-005] put while shares held", { phase: "shares-held" as const }, "PHASE_MISMATCH"],
    ["[EC-HT-001] halt active", { haltReason: "fx_loan" }, "HALT_ACTIVE"],
    ["[EC-MO-001] live without eligibility", { mode: "live" as const }, "LIVE_NOT_ELIGIBLE"],
  ])("%s ⇒ blocked", (_n, patch, reason) => {
    const r = evaluateDraft({ ...base, ...patch } as DraftContext);
    expect(r.status).toBe("blocked");
    expect(r.reasons).toContain(reason);
  });
  test("[EC-CS-003] exactly-funded reserve passes (boundary)", () => {
    expect(evaluateDraft({ ...base, settledCashUsd: $("65000") }).status).toBe("open");
  });
  test("[EC-HT-002] halt-raising rules report the halt to raise", () => {
    expect(evaluateDraft({ ...base, fxLoan: true, lotsOpen: 1 }).haltsToRaise.sort()).toEqual(["fx_loan", "second_lot_without_cash"]);
  });
  test("[EC-HT-003] halts never block a risk-reducing buy-to-close", () => {
    const close = evaluateDraft({ ...base, haltReason: "fx_loan", fxLoan: true, quote: null,
      draft: { ...base.draft, side: "BUY", openClose: "close" } });
    expect(close).toMatchObject({ status: "open", reasons: [] });
  });
  test("[EC-WH-004] covered call under basis blocked until locked-loss accepted; ITM warns", () => {
    const cc: DraftContext = { ...base, phase: "shares-held", costBasis: $("640.38"), spot: 640,
      draft: { ...base.draft, putCall: "C", strike: $("635") } };
    const blocked = evaluateDraft(cc);
    expect(blocked.reasons).toEqual(["LOCKED_LOSS_UNSIGNED"]);
    expect(blocked.warnings).toContain("CALL_ITM");
    expect(evaluateDraft({ ...cc, lockedLossAccepted: true }).status).toBe("open");
  });
  test("[EC-WH-008] ex-dividend before expiry warns on calls only", () => {
    const cc: DraftContext = { ...base, phase: "shares-held", costBasis: $("640.38"), exDividendDate: "2026-09-21",
      draft: { ...base.draft, putCall: "C", strike: $("760") } };
    expect(evaluateDraft(cc)).toMatchObject({ status: "open", warnings: ["EXDIV_ASSIGNMENT_RISK"] });
    expect(evaluateDraft({ ...base, exDividendDate: "2026-09-21" }).warnings).toEqual([]);
  });
  test("every reason code has user-facing text (copy completeness)", () => {
    for (const r of DRAFT_RULES) expect(REASON_TEXT[r.reason]).toBeDefined();
  });
});

describe("candidates & hurdle [US-1][US-6]", () => {
  test("Example B yield: 9.49 % annualised for comparison", () => {
    expect(premiumYieldAnn($("9.80"), $("650"), 58)).toBeCloseTo(0.0949, 4);
  });
  const quotes = [
    { quoteId: "a", putCall: "P" as const, expiry: "2026-11-20", strike: $("650"), bid: $("9.80"), ask: $("10.00") },
    { quoteId: "b", putCall: "P" as const, expiry: "2026-11-20", strike: $("640"), bid: $("8.40"), ask: $("8.60") },
    { quoteId: "c", putCall: "P" as const, expiry: "2026-11-20", strike: $("700"), bid: $("18.00"), ask: $("18.40") },
    { quoteId: "d", putCall: "P" as const, expiry: "2026-11-20", strike: $("660"), bid: $("11.00"), ask: $("13.50") },
    { quoteId: "e", putCall: "P" as const, expiry: "2026-11-20", strike: $("655"), bid: null, ask: $("10.50") },
    { quoteId: "f", putCall: "C" as const, expiry: "2026-11-20", strike: $("760"), bid: $("7.00"), ask: $("7.20") },
  ];
  const ctx = { now: NOW, spot: 721.11, quotesAsOf: new Date(NOW.getTime() - 60_000), envelopeId: "beginner_v1" as const,
    rfRate: 0.0378, settledCashUsd: $("100000"), reservedOpenUsd: $("0"), phase: "cash-put" as const, costBasis: null };
  test("[EC-PK-002] ranked rows first; rejected rows kept with reasons, unranked", () => {
    const out = scoreCandidates(quotes, ctx);
    expect(out.map((c) => c.quoteId)).toEqual(["a", "b", "e", "d", "c"]);
    expect(out.filter((c) => c.rank !== null).map((c) => c.rank)).toEqual([1, 2]);
    expect(out.find((c) => c.quoteId === "c")!.rejectReasons).toContain("OTM_OUTSIDE_ENVELOPE");
    expect(out.find((c) => c.quoteId === "d")!.rejectReasons).toContain("WIDE_SPREAD");
    expect(out.find((c) => c.quoteId === "e")!.rejectReasons).toContain("NO_BID");
    expect(toDecimalString(out[0]!.limitPrice)).toBe("9.8000"); // default limit = bid
  });
  test("[EC-MD-006] below T-bill hurdle is a reject reason", () => {
    const out = scoreCandidates(quotes, { ...ctx, rfRate: 0.2 });
    expect(out.every((c) => c.rank === null)).toBe(true);
    expect(out[0]!.rejectReasons).toContain("PREMIUM_BELOW_TBILL");
  });
  test("[EC-LG-005] annualise hidden below 4 quarters; cash position derived", () => {
    expect(annualise(0.02, 3)).toBeNull();
    expect(annualise(0.1, 8)).toBeCloseTo(0.0488, 3);
    expect(cashPosition($("100000"), $("65000"), $("65000"))).toMatchObject({ targetFunded: false });
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
