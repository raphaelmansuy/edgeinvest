// Evidence model (docs/03 §4): a competency passes when every rule has at least one passing evidence row. Pure projection.
export const COMPETENCIES = ["vocabulary", "arithmetic", "risk", "cash_discipline", "strike_selection", "management"] as const;
export type Competency = (typeof COMPETENCIES)[number];
export type CompetencyStatus = "locked" | "in_progress" | "passed";

export const MASTERY_RULES: Readonly<Record<Competency, readonly { rule: string; cid: string; label: string; where: string }[]>> = {
  vocabulary: [
    { rule: "vocab.flash_6of7", cid: "C-VOC-1", label: "6 of 7 flash cards in one graded run", where: "/learn/seven-words" },
    { rule: "vocab.quiz_m1", cid: "C-VOC-2", label: "Quiz M1 ≥ 80 %", where: "/learn/quizzes/M1" },
  ],
  arithmetic: [
    { rule: "arith.three_tickets", cid: "C-ARITH-1", label: "3 distinct tickets, four numbers exact", where: "/learn/arithmetic" },
    { rule: "arith.quiz_m3", cid: "C-ARITH-2", label: "Quiz M3 ≥ 80 %", where: "/learn/quizzes/M3" },
  ],
  risk: [
    { rule: "risk.crash_debrief", cid: "C-RISK-1", label: "Crash mode finished with debrief", where: "/learn/game/crash/dotcom_2000" },
    { rule: "risk.quiz_m7", cid: "C-RISK-2", label: "Quiz M7 ≥ 80 %", where: "/learn/quizzes/M7" },
  ],
  cash_discipline: [
    { rule: "cash.fx_loan_item", cid: "C-CASH-1", label: "FX-loan item answered correctly", where: "/learn/quizzes/M2" },
    { rule: "cash.paper_no_negative", cid: "C-CASH-2", label: "Paper wheel with no negative balance", where: "/learn/game/scenario/paper-lab" },
  ],
  strike_selection: [
    { rule: "strike.band_quiz", cid: "C-STRIKE-1", label: "Envelope band items correct", where: "/learn/quizzes/M4" },
    { rule: "strike.reject_out_of_band", cid: "C-STRIKE-2", label: "Rejects the out-of-band or below-hurdle candidate", where: "/learn/game/scenario/steady-2024" },
  ],
  management: [
    { rule: "mgmt.committee", cid: "C-MGMT-1", label: "Committee memo decided with rationale", where: "/learn/game/committee" },
    { rule: "mgmt.post_assign_cc_ge_basis", cid: "C-MGMT-2", label: "After assignment, call ≥ basis (or justified accept)", where: "/learn/game/post-assign" },
    { rule: "mgmt.short_call_outcome", cid: "C-MGMT-3", label: "Correct short-call outcome", where: "/learn/game/post-assign" },
  ],
};

export interface EvidenceRow { rule_id: string; passed: boolean }

export function projectMastery(evidence: readonly EvidenceRow[], paperWheelDone: boolean) {
  const passedRules = new Set(evidence.filter((e) => e.passed).map((e) => e.rule_id));
  const seenRules = new Set(evidence.map((e) => e.rule_id));
  const status = Object.fromEntries(COMPETENCIES.map((c) => {
    const rules = MASTERY_RULES[c].map((r) => r.rule);
    const s: CompetencyStatus = rules.every((r) => passedRules.has(r)) ? "passed" : rules.some((r) => seenRules.has(r)) ? "in_progress" : "locked";
    return [c, s];
  })) as Record<Competency, CompetencyStatus>;
  const allSix = COMPETENCIES.every((c) => status[c] === "passed");
  const progress = Object.fromEntries(COMPETENCIES.map((c) => {
    const rules = MASTERY_RULES[c];
    return [c, rules.filter((r) => passedRules.has(r.rule)).length / rules.length];
  })) as Record<Competency, number>;
  return { status, progress, passedRules: [...passedRules], allPass: allSix && paperWheelDone };
}

export const RULE_TO_COMPETENCY: Readonly<Record<string, Competency>> = Object.fromEntries(
  COMPETENCIES.flatMap((c) => MASTERY_RULES[c].map((r) => [r.rule, c])));
