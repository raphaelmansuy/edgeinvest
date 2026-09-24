import { describe, expect, test } from "bun:test";
import { COPY_RULES, lintText } from "@edge/copy";
import { REMEDIATION } from "../src";
import { type Decision, GameInputError, replayGame } from "../src/game";
import { QUIZZES, gradeQuiz, publicItems, quizItems } from "../src/items";
import { MODULES } from "../src/modules";
import { arithmeticTicket, gradeTicket } from "../src/tickets";
import { SEVEN_WORDS, gradeVocab, vocabRun } from "../src/vocab";

describe("quizzes [EC-LN-001, EC-LN-005]", () => {
  test("same seed ⇒ same items; different seeds vary parameters", () => {
    expect(quizItems("M3", 7)).toEqual(quizItems("M3", 7));
    const prompts = new Set([1, 2, 3, 4, 5, 6].map((s) => quizItems("M3", s)[0]!.prompt));
    expect(prompts.size).toBeGreaterThan(2);
  });
  test("public items never carry answers", () => {
    for (const m of Object.keys(QUIZZES)) for (const it of publicItems(quizItems(m, 3))) {
      expect(it).not.toHaveProperty("answer");
      expect(it).not.toHaveProperty("explain");
    }
  });
  test("all-correct passes, all-wrong fails with misconception tags", () => {
    for (const m of Object.keys(QUIZZES)) {
      const items = quizItems(m, 11);
      const good = gradeQuiz(m, 11, Object.fromEntries(items.map((i) => [i.id, i.answer])));
      expect(good.passed).toBe(true);
      const bad = gradeQuiz(m, 11, {});
      expect(bad.passed).toBe(false);
      expect(bad.missedTags.every((t) => REMEDIATION[t])).toBe(true);
    }
  });
  test("numeric answers accept commas and the typographic minus", () => {
    const items = quizItems("M3", 5);
    const a = Object.fromEntries(items.map((i) => [i.id, Number(i.answer).toLocaleString("en-US", { minimumFractionDigits: 2 }).replace("-", "−")]));
    expect(gradeQuiz("M3", 5, a).score).toBe(100);
  });
});

describe("vocabulary and tickets", () => {
  test("6 of 7 passes the flash run", () => {
    const run = vocabRun(1);
    expect(run).toHaveLength(7);
    const answers = Object.fromEntries(SEVEN_WORDS.map((c) => [c.word, c.answer]));
    answers.share = "1";
    expect(gradeVocab(answers).passed).toBe(true);
    answers.put = "x";
    expect(gradeVocab(answers).passed).toBe(false);
  });
  test("ticket grading is exact to the cent", () => {
    const t = arithmeticTicket(42);
    const r = gradeTicket(42, { reserve: String(t.strike * 100), max_profit: (t.premium * 100).toFixed(2), break_even: (t.strike - t.premium).toFixed(2), worst_case: (t.strike * 100 - t.premium * 100).toFixed(2) });
    expect(r.passed).toBe(true);
    expect(gradeTicket(42, { reserve: String(t.strike * 100 + 0.01) }).passed).toBe(false);
  });
});

describe("content copy lint [CP-*]", () => {
  test("module prose passes every copy rule", () => {
    for (const m of MODULES) for (const s of m.sections) expect(lintText(`${s.heading} ${s.body}`, "text").map((v) => v.rule)).toEqual([]);
    expect(COPY_RULES.length).toBeGreaterThan(4);
  });
});

const numbers = (strike: number, premium: number) => ({
  reserve: (strike * 100).toFixed(2), max_profit: (premium * 100).toFixed(2), break_even: (strike - premium).toFixed(2), worst_case: ((strike - premium) * 100).toFixed(2),
});

describe("game engine [US-1, US-3, US-8, EC-LN-007]", () => {
  test("scenario: skip earns evidence and a rubric without P&L points", () => {
    const v0 = replayGame("scenario", "steady-2024", 9, []);
    expect(v0.prompt?.stage).toBe("numbers");
    const t = v0.brief.ticket!;
    const v = replayGame("scenario", "steady-2024", 9, [numbers(t.strike, t.premium), { choice: "skip" }]);
    expect(v.finished).toBe(true);
    expect(v.evidence).toEqual([{ rule: "strike.reject_out_of_band", passed: true }]);
    expect(v.rubric!.score).toBe(100);
  });
  test("scenario: choosing the out-of-band candidate fails C-STRIKE-2", () => {
    const v0 = replayGame("scenario", "chop-2022", 3, []);
    const bad = v0.brief.candidates!.find((c) => !c.inBand)!;
    const t = v0.brief.ticket!;
    const v = replayGame("scenario", "chop-2022", 3, [numbers(t.strike, t.premium), { choice: bad.id, qty: "1", plan: "hold to expiry and accept assignment" }, { action: "hold", followed: "yes" }]);
    expect(v.finished).toBe(true);
    expect(v.evidence[0]).toEqual({ rule: "strike.reject_out_of_band", passed: false });
    expect(v.rubric!.items.find((i) => i.id === "envelope")!.earned).toBe(0);
  });
  test("invalid input is refused, not stored", () => {
    expect(() => replayGame("scenario", "steady-2024", 9, [{ reserve: "1" }])).toThrow(GameInputError);
  });
  test("crash mode reaches the −20 % checkpoint and grades the debrief", () => {
    const v0 = replayGame("crash", "dotcom_2000", 5, []);
    const t = v0.brief.ticket!;
    const d: Decision[] = [numbers(t.strike, t.premium), { plan: "hold and accept assignment, then sell a call", sizing: "one_lot" }, { action: "hold", followed: "yes" }, { p05: "one_in_20", lesson: "the drawdown is deep and fast" }];
    const v = replayGame("crash", "dotcom_2000", 5, d);
    expect(v.finished).toBe(true);
    expect(v.path!.marks.some((m) => m.label.includes("checkpoint"))).toBe(true);
    expect(v.evidence).toEqual([{ rule: "risk.crash_debrief", passed: true }]);
  });
  test("post-assign: call ≥ basis and correct outcome", () => {
    const v0 = replayGame("post_assign", "assigned", 21, []);
    const basis = v0.brief.basis!;
    const opt = v0.prompt!.fields[0]!.options!.find((o) => Number(o.value) >= basis)!;
    const v1 = replayGame("post_assign", "assigned", 21, [{ strike: opt.value }]);
    const title = v1.prompt!.title;
    const sT = Number(title.match(/closes at ([\d.]+)/)![1]);
    const v = replayGame("post_assign", "assigned", 21, [{ strike: opt.value }, { outcome: sT > Number(opt.value) ? "called_away" : "expired" }]);
    expect(v.evidence.every((e) => e.passed)).toBe(true);
  });
  test("paper lab walks the full wheel with the domain state machine", () => {
    const v0 = replayGame("paper_lab", "paper-lab", 8, [], { startCashUsd: 100_000 });
    const v1 = replayGame("paper_lab", "paper-lab", 8, [{ convert_usd: "100000" }]);
    const put = v1.prompt!.fields[0]!.options![0]!.value;
    const v2 = replayGame("paper_lab", "paper-lab", 8, [{ convert_usd: "100000" }, { strike: put }]);
    const basis = v2.brief.basis!;
    const call = v2.prompt!.fields[0]!.options!.find((o) => Number(o.value) >= basis)!.value;
    const v = replayGame("paper_lab", "paper-lab", 8, [{ convert_usd: "100000" }, { strike: put }, { strike: call }, { lesson: "convert first and keep one lot" }]);
    expect(v0.prompt!.stage).toBe("fx");
    expect(v.finished).toBe(true);
    expect(v.wheel).toBe("closed");
    expect(v.paperWheelCompleted).toBe(true);
    expect(v.evidence).toEqual([{ rule: "cash.paper_no_negative", passed: true }]);
  });
  test("paper lab without converting enough USD fails C-CASH-2", () => {
    const v1 = replayGame("paper_lab", "paper-lab", 8, [{ convert_usd: "1000" }]);
    const put = v1.prompt!.fields[0]!.options![0]!.value;
    const v2 = replayGame("paper_lab", "paper-lab", 8, [{ convert_usd: "1000" }, { strike: put }]);
    const call = v2.prompt!.fields[0]!.options!.find((o) => Number(o.value) >= v2.brief.basis!)!.value;
    const v = replayGame("paper_lab", "paper-lab", 8, [{ convert_usd: "1000" }, { strike: put }, { strike: call }, { lesson: "convert first and keep one lot" }]);
    expect(v.evidence[0]!.passed).toBe(false);
  });
  test("committee memo is evidence for C-MGMT-1", () => {
    const v = replayGame("committee", "monthly", 4, [{ premortem: "a fast crash through the strike" }, { decision: "skip", rationale: "premium barely beats the T-bill" }]);
    expect(v.evidence).toEqual([{ rule: "mgmt.committee", passed: true }]);
    expect(v.brief.packet!.mcP05).toBeLessThan(v.brief.packet!.mcP95);
  });
});
