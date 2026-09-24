// Serious game engine (docs/03 §5–6). Pure: state = replay(mode, scenario, seed, decisions). The paper lab uses the same
// domain rules (invariants, wheel state machine, envelope band) as real drafts, and never writes wheel_cycle or ledger (EC-LN-007).
import {
  type CycleState, ENVELOPES, formatUsd, fromDollars, intBetween, mulberry32, shortPutInvariants, shuffle, transition,
} from "@edge/domain";
import { CRASH_SCENARIOS, QUARTERLY, bsCall, bsPut, replayCrash, roundCents, roundStrikeDown, runPutsOnlyMc } from "@edge/sim";

export type GameMode = "tutorial" | "scenario" | "crash" | "committee" | "post_assign" | "paper_lab";
export type Decision = Record<string, string | number | boolean>;

export interface FieldOption { value: string; label: string; meta?: string; tone?: "loss" | "caution" | "ok" }
export interface Field {
  name: string;
  kind: "money" | "text" | "textarea" | "radio" | "cards";
  label: string;
  hint?: string;
  options?: FieldOption[];
  minLength?: number;
  optional?: boolean;
  showIf?: { field: string; equals: string[] };
}
export interface Prompt { stage: string; title: string; body: string; fields: Field[]; cta: string }
export interface Feedback { tone: "ok" | "caution" | "loss" | "info"; text: string }
export interface GameCandidate { id: string; strike: number; bid: number; ask: number; otmPct: number; dte: number; yieldAnn: number; inBand: boolean; belowHurdle: boolean }
export interface RubricItem { id: string; label: string; weight: number; earned: number; note: string }
export interface GameView {
  mode: GameMode;
  scenarioId: string;
  seed: number;
  title: string;
  narrative: string;
  finished: boolean;
  prompt: Prompt | null;
  brief: {
    spot: number; rf: number; dte?: number; envelope: string;
    candidates?: GameCandidate[];
    ticket?: { strike: number; premium: number; putCall: "P" | "C" };
    basis?: number;
    holdings?: { usd: number; hkd: number; shares: number };
    packet?: { crashMaxDd: number; crashFillMaxDd: number; mcP05: number; mcP50: number; mcP95: number; pBelow: number; scenarioTitle: string };
  };
  path: { dates: string[]; spot: number[]; revealed: number; marks: { week: number; label: string }[]; strike?: number; callStrike?: number } | null;
  wheel: CycleState;
  balances: { label: string; usd: number; hkd: number; shares: number }[];
  feedback: Feedback[];
  rubric: { items: RubricItem[]; score: number; pnl: number | null; pnlNote: string } | null;
  evidence: { rule: string; passed: boolean }[];
  paperWheelCompleted: boolean;
}

export class GameInputError extends Error {}
class Pending { constructor(readonly prompt: Prompt) {} }

class Runner {
  i = 0;
  constructor(readonly decisions: readonly Decision[], readonly view: GameView) {}
  ask(prompt: Prompt, validate: (d: Decision) => string | null = () => null): Decision {
    const d = this.decisions[this.i];
    if (!d) throw new Pending(prompt);
    const missing = prompt.fields.find((f) => !f.optional && visible(f, d) && (d[f.name] === undefined || String(d[f.name]).trim() === ""));
    if (missing) throw new GameInputError(`${missing.label} is required`);
    const short = prompt.fields.find((f) => f.minLength && visible(f, d) && String(d[f.name] ?? "").trim().length < f.minLength);
    if (short) throw new GameInputError(`${short.label}: at least ${short.minLength} characters`);
    const bad = prompt.fields.find((f) => f.options && visible(f, d) && d[f.name] !== undefined && !f.options.some((o) => o.value === String(d[f.name])));
    if (bad) throw new GameInputError(`${bad.label}: choose one of the options`);
    const err = validate(d);
    if (err) throw new GameInputError(err);
    this.i++;
    return d;
  }
}
const visible = (f: Field, d: Decision) => !f.showIf || f.showIf.equals.includes(String(d[f.showIf.field] ?? ""));

const usd = (n: number) => formatUsd(fromDollars(Math.round(n * 100) / 100));
const pctS = (x: number) => `${(x * 100).toFixed(1)} %`;
const SPOT = 721.11;
const RF = 0.0378;
const HKD_PER_USD = 7.8;

function gbm(rnd: () => number, weeks: number, s0: number, mu: number, sigma: number) {
  const out = [s0];
  for (let w = 1; w <= weeks; w++) {
    const u = Math.max(rnd(), 1e-12), v = rnd();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    out.push(roundCents(out[w - 1]! * Math.exp(mu - 0.5 * sigma * sigma + sigma * z)));
  }
  return out;
}
function steerTo(path: number[], target: number) {
  const k = (target / path.at(-1)!) ** (1 / (path.length - 1));
  return path.map((p, i) => roundCents(p * k ** i));
}
const weekDates = (start: string, n: number) => Array.from({ length: n }, (_, i) => new Date(Date.parse(`${start}T00:00:00Z`) + i * 7 * 86_400_000).toISOString().slice(0, 10));

function candidateSet(rnd: () => number, spot: number, dte: number, iv: number) {
  const env = ENVELOPES.beginner_v1;
  const T = dte / 365;
  const mk = (otm: number, ivAdj = 0): Omit<GameCandidate, "id"> => {
    const strike = roundStrikeDown(spot * (1 - otm));
    const mid = bsPut(spot, strike, T, RF, iv + ivAdj);
    const bid = Math.max(0.05, roundCents(mid * 0.985));
    const ask = roundCents(mid * 1.015 + 0.02);
    const otmPct = 1 - strike / spot;
    const yieldAnn = (bid / strike) * (365 / dte);
    return { strike, bid, ask, otmPct, dte, yieldAnn, inBand: otmPct >= env.otmMin && otmPct <= env.otmMax, belowHurdle: yieldAnn < RF };
  };
  const rows = [mk(0.075 + rnd() * 0.01), mk(0.055 + rnd() * 0.01), mk(0.118, -0.03), mk(0.03)];
  return shuffle(rnd, rows).map((r, i) => ({ ...r, id: "ABCD"[i]! }));
}

const numbersFields = (label: string): Field[] => [
  { name: "reserve", kind: "money", label: "Reserve", hint: "strike × 100" },
  { name: "max_profit", kind: "money", label: "Max profit", hint: "premium × 100, before fees" },
  { name: "break_even", kind: "money", label: "Break-even", hint: "per share" },
  { name: "worst_case", kind: "money", label: `Worst case ${label}`, hint: "if QQQ went to 0" },
];
function checkNumbers(d: Decision, strike: number, premium: number) {
  const inv = shortPutInvariants({ strike: fromDollars(strike), premium: fromDollars(premium), qty: 1 });
  const want = { reserve: inv.reserve, max_profit: inv.maxProfit, break_even: inv.breakEven, worst_case: inv.worstCase };
  const wrong = (Object.keys(want) as (keyof typeof want)[]).filter((k) => {
    const v = Number(String(d[k] ?? "").replace(/[,\s]/g, ""));
    return !Number.isFinite(v) || Math.round(v * 100) !== Math.round(want[k] / 100);
  });
  return { ok: wrong.length === 0, wrong, want };
}
const numbersFeedback = (strike: number, premium: number): Feedback => ({ tone: "info",
  text: `Selling one QQQ ${strike} put for ${premium.toFixed(2)} reserves USD ${usd(strike * 100)} and creates a maximum profit of USD ${usd(premium * 100)}. Break-even USD ${usd(strike - premium)}. Below that, losses increase dollar-for-dollar with QQQ.` });

function rubric(items: RubricItem[], pnl: number | null) {
  return { items, score: items.reduce((a, b) => a + b.earned, 0), pnl, pnlNote: "Outcome P&L is shown for context only. It is worth 0 points: good decisions can lose money." };
}
const item = (id: string, label: string, weight: number, ok: boolean, note: string): RubricItem => ({ id, label, weight, earned: ok ? weight : 0, note });

const followFields = (plan: string): Field[] => [
  { name: "action", kind: "radio", label: "What do you do now?", options: [
    { value: "hold", label: "Hold, as planned: the reserve is already set aside" },
    { value: "buy_back", label: "Buy back the put and take the loss" },
    { value: "roll", label: "Roll to a later expiry inside the envelope" },
  ] },
  { name: "followed", kind: "radio", label: plan ? `Your plan said: “${plan}”. Is this action your plan?` : "Is this action what you planned?", options: [
    { value: "yes", label: "Yes, this is my plan" }, { value: "no", label: "No, I am deviating" }] },
  { name: "deviation", kind: "textarea", label: "Explain the deviation", minLength: 10, showIf: { field: "followed", equals: ["no"] } },
];

// ------------------------------------------------------------------ catalogue
export const GAME_SCENARIOS = [
  { id: "steady-2024", mode: "scenario", title: "A calm quarter", narrative: "QQQ drifts up with modest volatility. Four strikes, one month, one decision.", mu: 0.0025, sigma: 0.02 },
  { id: "chop-2022", mode: "scenario", title: "A choppy quarter", narrative: "Rates rise and QQQ swings. The premium looks richer; so is the risk.", mu: -0.006, sigma: 0.038 },
  { id: "paper-lab", mode: "paper_lab", title: "Paper lab: one full wheel", narrative: "HKD in, one put, a forced assignment, one covered call, called away. Every balance is shown.", mu: 0, sigma: 0.03 },
] as const;
export const CRASH_GAMES = Object.values(CRASH_SCENARIOS).map((s) => ({ id: s.id, title: s.title, narrative: s.narrative }));

// ------------------------------------------------------------------ modes
function scenarioMode(g: Runner, rnd: () => number, def: (typeof GAME_SCENARIOS)[number]) {
  const v = g.view;
  const dte = 84;
  const cands = candidateSet(rnd, SPOT, dte, 0.2 + def.sigma);
  v.brief = { spot: SPOT, rf: RF, dte, envelope: "Beginner 5–12 %", candidates: cands };
  const featured = cands.filter((c) => c.inBand && !c.belowHurdle).sort((a, b) => a.otmPct - b.otmPct).at(-1)!;
  v.brief.ticket = { strike: featured.strike, premium: featured.bid, putCall: "P" };
  const nums = g.ask({ stage: "numbers", title: "State the four numbers first", cta: "Check my numbers",
    body: `Before choosing, write the numbers for candidate ${featured.id}: sell 1 QQQ ${featured.strike} put at the bid ${featured.bid.toFixed(2)}.`,
    fields: numbersFields("") });
  const n = checkNumbers(nums, featured.strike, featured.bid);
  v.feedback.push(n.ok ? { tone: "ok", text: "All four numbers are exact." } : { tone: "caution", text: `Check: ${n.wrong.join(", ").replaceAll("_", " ")}.` }, numbersFeedback(featured.strike, featured.bid));

  const choose = g.ask({ stage: "choose", title: "Decide", cta: "Commit decision",
    body: `T-bill hurdle ${pctS(RF)}. Skip is a valid decision and is scored like any other.`,
    fields: [
      { name: "choice", kind: "cards", label: "Candidate", options: [
        ...cands.map((c) => ({ value: c.id, label: `${c.id} · ${c.strike} put · bid ${c.bid.toFixed(2)}`,
          meta: `${pctS(c.otmPct)} OTM · ${pctS(c.yieldAnn)} annualised${c.inBand ? "" : " · outside band"}${c.belowHurdle ? " · below T-bill" : ""}`,
          tone: (!c.inBand ? "loss" : c.belowHurdle ? "caution" : undefined) as FieldOption["tone"] })),
        { value: "skip", label: "Skip this month", meta: "keep the reserve in T-bills" }] },
      { name: "qty", kind: "radio", label: "Contracts", options: [{ value: "1", label: "1 (one lot)" }, { value: "2", label: "2" }], showIf: { field: "choice", equals: ["A", "B", "C", "D"] } },
      { name: "plan", kind: "textarea", label: "If QQQ falls sharply in the next weeks, I will…", minLength: 10, showIf: { field: "choice", equals: ["A", "B", "C", "D"] } },
    ] });
  const skip = choose.choice === "skip";
  const pick_ = cands.find((c) => c.id === choose.choice);
  const qty = skip ? 0 : Number(choose.qty ?? 1);
  const plan = String(choose.plan ?? "");
  const path = gbm(rnd, 12, SPOT, def.mu, def.sigma);
  const dates = weekDates("2026-09-07", path.length);
  v.path = { dates, spot: path, revealed: 1, marks: [{ week: 0, label: "decide" }], strike: pick_?.strike };
  if (pick_) {
    v.feedback.push(!pick_.inBand ? { tone: "loss", text: `${pick_.strike} is outside the Beginner band (${pctS(pick_.otmPct)} OTM).` }
      : pick_.belowHurdle ? { tone: "caution", text: `${pick_.strike} pays ${pctS(pick_.yieldAnn)} annualised, below the ${pctS(RF)} T-bill: the safe-strike trap.` }
        : { tone: "ok", text: `${pick_.strike} is inside the band and above the hurdle.` });
  } else v.feedback.push({ tone: "ok", text: "You skipped. Skipping is a decision, and it is logged like any other." });
  if (qty > 1) v.feedback.push({ tone: "loss", text: "Two contracts is two lots. The method is one lot at a time." });

  let action = "hold", followed = true, deviation = "";
  if (pick_) {
    const cp = 6;
    v.path.revealed = cp + 1;
    v.path.marks.push({ week: cp, label: "checkpoint" });
    const move = path[cp]! / SPOT - 1;
    const a = g.ask({ stage: "checkpoint", title: `Week ${cp}: QQQ ${path[cp]!.toFixed(2)} (${move >= 0 ? "+" : ""}${pctS(move)})`, cta: "Continue to expiry",
      body: path[cp]! < pick_.strike ? `QQQ is below your ${pick_.strike} strike. On paper you are losing money.` : `QQQ is above your ${pick_.strike} strike.`,
      fields: followFields(plan) });
    action = String(a.action); followed = a.followed === "yes"; deviation = String(a.deviation ?? "");
  }
  v.path.revealed = path.length;
  const sT = path.at(-1)!;
  let pnl = 0;
  if (pick_) {
    if (action === "buy_back") {
      const T = (dte - 42) / 365;
      pnl = (pick_.bid - roundCents(bsPut(path[6]!, pick_.strike, T, RF, 0.2 + def.sigma))) * 100 * qty;
      v.feedback.push({ tone: "info", text: `Bought back at week 6. Net ${usd(pnl)} USD.` });
    } else {
      pnl = (pick_.bid - Math.max(0, pick_.strike - sT)) * 100 * qty;
      v.feedback.push({ tone: "info", text: sT < pick_.strike
        ? `Expiry at ${sT.toFixed(2)}: assigned at ${pick_.strike}. Shares are worth ${usd((sT - pick_.strike) * 100 * qty)} vs the strike, plus the premium.`
        : `Expiry at ${sT.toFixed(2)}: the put expired. You keep ${usd(pick_.bid * 100 * qty)} USD; the reserve is released.` });
    }
  }
  const rejected = skip || (pick_!.inBand && !pick_!.belowHurdle);
  v.evidence.push({ rule: "strike.reject_out_of_band", passed: rejected });
  v.rubric = rubric([
    item("numbers", "Four numbers stated correctly before deciding", 25, n.ok, n.ok ? "exact to the cent" : `wrong: ${n.wrong.join(", ")}`),
    item("envelope", "Stayed inside the envelope (or skipped)", 20, skip || pick_!.inBand, skip ? "skipped" : pick_!.inBand ? "in band" : "outside band"),
    item("hurdle", "Applied the T-bill hurdle", 15, skip || !pick_!.belowHurdle, skip || !pick_!.belowHurdle ? "above hurdle or skipped" : "below the T-bill"),
    item("plan", "Wrote a plan, then followed it or explained the deviation", 25, skip || (plan.length >= 10 && (followed || deviation.length >= 10)), skip ? "not needed when skipping" : followed ? "followed" : "deviation explained"),
    item("sizing", "Respected one lot", 15, qty <= 1, qty <= 1 ? "one lot" : `${qty} lots`),
  ], skip ? 0 : pnl);
}

function crashMode(g: Runner, id: string) {
  const s = CRASH_SCENARIOS[id]!;
  const v = g.view;
  const k = SPOT / s.weekly_close[0]!;
  const path = s.weekly_close.slice(0, 27).map((c) => roundCents(c * k));
  const dates = s.weekly_dates.slice(0, 27);
  const strike = roundStrikeDown(SPOT * 0.92);
  const premium = roundCents(bsPut(SPOT, strike, 0.25, s.rf, s.iv_path[0]!));
  v.title = `Crash: ${s.title}`;
  v.narrative = s.narrative;
  v.brief = { spot: SPOT, rf: s.rf, dte: 91, envelope: "Beginner 5–12 %", ticket: { strike, premium, putCall: "P" } };
  v.path = { dates, spot: path, revealed: 1, marks: [{ week: 0, label: "sell" }], strike };
  const nums = g.ask({ stage: "numbers", title: "Numbers first", cta: "Check my numbers",
    body: `The replay rescales ${s.start} to today's QQQ ${SPOT}. You sell 1 QQQ ${strike} put, about 13 weeks, at ${premium.toFixed(2)}.`, fields: numbersFields("") });
  const n = checkNumbers(nums, strike, premium);
  v.feedback.push(n.ok ? { tone: "ok", text: "All four numbers are exact." } : { tone: "caution", text: `Check: ${n.wrong.join(", ").replaceAll("_", " ")}.` }, numbersFeedback(strike, premium));
  const p = g.ask({ stage: "plan", title: "Pre-commit", cta: "Start the replay", body: "Write what you will do if QQQ falls 20 % in the first weeks. The replay will stop there and show it back to you.",
    fields: [
      { name: "plan", kind: "textarea", label: "If QQQ is −20 % in the first weeks, I will…", minLength: 10 },
      { name: "sizing", kind: "radio", label: "Sizing", options: [{ value: "one_lot", label: "One lot" }, { value: "fill_cash", label: "Fill cash (as many lots as cash allows)", meta: "dangerous" }] },
    ] });
  const plan = String(p.plan);
  let cp = path.findIndex((x, i) => i > 0 && i <= 13 && x <= SPOT * 0.8);
  if (cp < 0) cp = path.slice(1, 14).reduce((best, x, i) => (x < path[best]! ? i + 1 : best), 1);
  v.path.revealed = cp + 1;
  v.path.marks.push({ week: cp, label: "−20 % checkpoint" });
  const a = g.ask({ stage: "checkpoint", title: `Week ${cp}: QQQ ${path[cp]!.toFixed(2)} (${pctS(path[cp]! / SPOT - 1)})`, cta: "Continue",
    body: `The put is deep in the money. Marked to market the position is about ${usd((premium - bsPut(path[cp]!, strike, (13 - cp) / 52, s.rf, s.iv_path[cp]!)) * 100)} USD.`,
    fields: followFields(plan) });
  const followed = a.followed === "yes";
  const deviation = String(a.deviation ?? "");
  v.path.revealed = path.length;
  v.path.marks.push({ week: 13, label: "expiry" });
  const replay = replayCrash(s, { otm: 0.08, startCash: 150_000, maxContracts: 1, fillCash: p.sizing === "fill_cash", wheel: true, reserveEarnsRf: true, scaleToSpot: SPOT });
  const oneDd = replay.summary.csp_one_lot.max_dd, fillDd = replay.summary.csp_fill_cash.max_dd;
  const s13 = path[13]!;
  v.feedback.push({ tone: s13 < strike ? "caution" : "info", text: s13 < strike
    ? `Week 13: QQQ ${s13.toFixed(2)}, assigned at ${strike}. Decision basis ${usd(strike - premium)}. The wheel continues with a covered call at or above basis.`
    : `Week 13: QQQ ${s13.toFixed(2)}, above the strike. The put expired.` },
  { tone: "info", text: `Full replay at 150,000 USD: one lot max drawdown ${pctS(oneDd)}, fill cash ${pctS(fillDd)}.` });
  const mc = runPutsOnlyMc({ quarterlyReturns: QUARTERLY.returns, paths: 1000, quarters: 20, seed: g.view.seed, otm: 0.08, rf: RF, iv: QUARTERLY.iv_default, startCash: 100_000, spot: SPOT, maxContracts: 1, fillCash: false });
  const p05 = Math.round(mc.wealth_p05 / 1000) * 1000;
  const deb = g.ask({ stage: "debrief", title: "Debrief", cta: "Finish",
    body: `A 1,000-path Monte Carlo from 100,000 USD over 5 years puts p05 at about ${usd(p05)} USD.`,
    fields: [
      { name: "p05", kind: "radio", label: "What does p05 mean?", options: [
        { value: "one_in_20", label: `About 1 path in 20 ends at or below ${usd(p05)}` },
        { value: "worst", label: `${usd(p05)} is the worst that can happen` },
        { value: "expected", label: `${usd(p05)} is the expected outcome` }] },
      { name: "lesson", kind: "textarea", label: "One sentence you will remember from this replay", minLength: 10 },
    ] });
  const p05ok = deb.p05 === "one_in_20";
  const planOk = plan.length >= 10 && (followed || deviation.length >= 10);
  v.evidence.push({ rule: "risk.crash_debrief", passed: p05ok && planOk });
  v.rubric = rubric([
    item("numbers", "Four numbers stated correctly before deciding", 25, n.ok, n.ok ? "exact" : `wrong: ${n.wrong.join(", ")}`),
    item("envelope", "Stayed inside the envelope", 20, true, "8 % OTM, Beginner band"),
    item("hurdle", "Read the distribution (p05)", 15, p05ok, p05ok ? "p05 identified" : "p05 is a bad plausible path, not the worst"),
    item("plan", "Plan written, then followed or deviation explained", 25, planOk, followed ? "followed" : deviation ? "deviation explained" : "missing"),
    item("sizing", "Respected one lot", 15, p.sizing === "one_lot", p.sizing === "one_lot" ? "one lot" : `fill cash: max drawdown ${pctS(fillDd)}`),
  ], (premium - Math.max(0, strike - s13)) * 100);
}

function committeeMode(g: Runner, rnd: () => number) {
  const v = g.view;
  const cands = candidateSet(rnd, SPOT, 84, 0.22);
  const c = cands.filter((x) => x.inBand && !x.belowHurdle).sort((a, b) => b.yieldAnn - a.yieldAnn)[0]!;
  const crash = replayCrash(CRASH_SCENARIOS.covid_2020!, { otm: c.otmPct, startCash: 100_000, maxContracts: 1, fillCash: false, wheel: true, reserveEarnsRf: true, scaleToSpot: SPOT });
  const mc = runPutsOnlyMc({ quarterlyReturns: QUARTERLY.returns, paths: 1000, quarters: 20, seed: v.seed, otm: c.otmPct, rf: RF, iv: QUARTERLY.iv_default, startCash: 100_000, spot: SPOT, maxContracts: 1, fillCash: false });
  v.brief = { spot: SPOT, rf: RF, dte: 84, envelope: "Beginner 5–12 %", candidates: [c], ticket: { strike: c.strike, premium: c.bid, putCall: "P" },
    packet: { crashMaxDd: crash.summary.csp_one_lot.max_dd, crashFillMaxDd: crash.summary.csp_fill_cash.max_dd, mcP05: mc.wealth_p05, mcP50: mc.wealth_p50, mcP95: mc.wealth_p95, pBelow: mc.p_below_start, scenarioTitle: crash.scenario.title } };
  v.feedback.push(numbersFeedback(c.strike, c.bid));
  const pm = g.ask({ stage: "premortem", title: "Premortem", cta: "Continue", body: "It is three months from now and this trade went badly. What happened?",
    fields: [{ name: "premortem", kind: "textarea", label: "What makes this trade go wrong?", minLength: 10 }] });
  const d = g.ask({ stage: "decide", title: "Committee decision", cta: "Record the memo", body: "Sell, skip or wait. All three are valid; the memo is what is graded.",
    fields: [
      { name: "decision", kind: "radio", label: "Decision", options: [
        { value: "skip", label: "Skip this month" }, { value: "wait", label: "Wait for a better setup" }, { value: "sell", label: `Prepare a ${c.strike} put (paper)` }] },
      { name: "rationale", kind: "textarea", label: "Rationale", minLength: 10 },
      { name: "plan", kind: "textarea", label: "If QQQ falls 20 % in week two, I will…", minLength: 10, showIf: { field: "decision", equals: ["sell"] } },
    ] });
  const ok = String(d.rationale).length >= 10 && (d.decision !== "sell" || String(d.plan ?? "").length >= 10);
  v.evidence.push({ rule: "mgmt.committee", passed: ok });
  v.feedback.push({ tone: "ok", text: d.decision === "sell" ? "Memo recorded with a pre-commitment plan." : "Memo recorded. Not trading is a decision, and it is logged like any other." });
  v.rubric = rubric([
    item("premortem", "Premortem written before deciding", 25, String(pm.premortem).length >= 10, "failure imagined first"),
    item("packet", "Crash and Monte Carlo in the packet", 20, true, "shown before the decision"),
    item("hurdle", "Premium compared with the T-bill", 15, true, `${pctS(c.yieldAnn)} vs ${pctS(RF)}`),
    item("rationale", "Rationale and (if selling) a plan", 25, ok, ok ? "complete" : "missing"),
    item("sizing", "One lot", 15, true, "one lot"),
  ], null);
}

function postAssignMode(g: Runner, rnd: () => number) {
  const v = g.view;
  const putStrike = [620, 640, 650, 660][intBetween(rnd, 0, 3)]!;
  const putPremium = intBetween(rnd, 900, 1400) / 100;
  const basis = roundCents(putStrike - putPremium);
  const spot = roundCents(basis * (0.9 + rnd() * 0.05));
  const T = 84 / 365;
  const strikes = [Math.floor(basis) - 40, Math.floor(basis) - 15, Math.ceil(basis) + 1, Math.ceil(basis) + 25];
  const calls = strikes.map((K) => ({ K, bid: Math.max(0.05, roundCents(bsCall(spot, K, T, RF, 0.26) * 0.985)) }));
  v.brief = { spot, rf: RF, dte: 84, envelope: "covered call ≥ basis", basis, ticket: { strike: putStrike, premium: putPremium, putCall: "P" }, holdings: { usd: 0, hkd: 0, shares: 100 } };
  v.wheel = "shares_held";
  v.feedback.push({ tone: "info", text: `Assigned: you bought 100 QQQ at ${putStrike}. Premium received ${putPremium.toFixed(2)}. Decision basis ${usd(basis)} per share. QQQ is now ${spot.toFixed(2)}.` });
  const c = g.ask({ stage: "call", title: "Choose a covered call", cta: "Sell to open (paper)", body: `One call, about 84 days. Being called away below ${usd(basis)} locks in a loss.`,
    fields: [
      { name: "strike", kind: "cards", label: "Call strike", options: calls.map((x) => ({ value: String(x.K), label: `${x.K} call · bid ${x.bid.toFixed(2)}`,
        meta: x.K < basis ? `below basis by ${usd(basis - x.K)} · locked loss` : `at or above basis`, tone: (x.K < basis ? "loss" : "ok") as FieldOption["tone"] })) },
      { name: "justification", kind: "textarea", label: "You chose a strike below basis. Why accept a locked loss?", minLength: 10,
        showIf: { field: "strike", equals: strikes.filter((K) => K < basis).map(String) } },
    ] });
  const K = Number(c.strike);
  const call = calls.find((x) => x.K === K)!;
  const justified = K >= basis || String(c.justification ?? "").length >= 10;
  v.evidence.push({ rule: "mgmt.post_assign_cc_ge_basis", passed: justified });
  v.wheel = "shares_short_call";
  const up = rnd() < 0.5;
  const sT = roundCents(up ? K * (1.02 + rnd() * 0.05) : K * (0.93 + rnd() * 0.05));
  const path = steerTo(gbm(rnd, 12, spot, 0, 0.03), sT);
  v.path = { dates: weekDates("2026-12-07", path.length), spot: path, revealed: path.length, marks: [{ week: 0, label: "sell call" }, { week: 12, label: "expiry" }], strike: basis, callStrike: K };
  const o = g.ask({ stage: "outcome", title: `Expiry: QQQ closes at ${sT.toFixed(2)}`, cta: "Record outcome", body: `Your short call strike is ${K}.`,
    fields: [{ name: "outcome", kind: "radio", label: "What happens?", options: [
      { value: "called_away", label: "Called away: shares delivered at the strike, back to cash" },
      { value: "expired", label: "Expired: keep the shares and the premium" },
      { value: "bought_back", label: "I must buy the call back first" }] }] });
  const right = sT > K ? "called_away" : "expired";
  v.evidence.push({ rule: "mgmt.short_call_outcome", passed: o.outcome === right });
  v.wheel = right === "called_away" ? "closed" : "shares_held";
  v.feedback.push(o.outcome === right ? { tone: "ok", text: "Correct outcome." } : { tone: "caution", text: `Not quite: at ${sT.toFixed(2)} vs ${K} the call ${right === "called_away" ? "is assigned; shares are called away" : "expires; you keep the shares"}.` });
  const pnl = right === "called_away" ? (K - basis + call.bid) * 100 : call.bid * 100;
  v.rubric = rubric([
    item("hold", "Kept the shares after assignment", 25, true, "no panic sale"),
    item("basis", "Call strike at or above basis (or justified)", 30, justified, K >= basis ? "≥ basis" : justified ? "locked loss justified" : "below basis"),
    item("outcome", "Correct lifecycle outcome", 30, o.outcome === right, right.replace("_", " ")),
    item("sizing", "One lot", 15, true, "100 shares, one call"),
  ], pnl);
}

function paperLabMode(g: Runner, rnd: () => number, startCashUsd: number) {
  const v = g.view;
  let wheel: CycleState = "none";
  const step = (type: Parameters<typeof transition>[1]["type"]) => {
    const t = transition(wheel, { type } as never);
    if (!t.ok) throw new GameInputError(`Illegal wheel step ${type} from ${wheel}`);
    wheel = t.to; v.wheel = wheel;
  };
  const bal = { usd: 0, hkd: Math.round(startCashUsd * HKD_PER_USD), shares: 0 };
  const snap = (label: string) => v.balances.push({ label, ...bal });
  snap("start");
  const cands = candidateSet(rnd, SPOT, 84, 0.22).filter((c) => c.inBand);
  v.brief = { spot: SPOT, rf: RF, dte: 84, envelope: "Beginner 5–12 %", candidates: cands, holdings: { ...bal } };
  const fx = g.ask({ stage: "fx", title: "Layer 1: FX first", cta: "Convert",
    body: `The paper account starts with HKD ${bal.hkd.toLocaleString("en-US")} and 0 USD (7.80 HKD per USD). A put is secured in USD only.`,
    fields: [{ name: "convert_usd", kind: "money", label: "Convert to USD", hint: `up to ${usd(bal.hkd / HKD_PER_USD)}` }] },
    (d) => { const x = Number(d.convert_usd); return !Number.isFinite(x) || x < 0 || x * HKD_PER_USD > bal.hkd + 0.5 ? "Enter an amount you can convert" : null; });
  const conv = Number(fx.convert_usd);
  bal.hkd = Math.round(bal.hkd - conv * HKD_PER_USD); bal.usd = conv; snap("after FX");
  const sp = g.ask({ stage: "sell_put", title: "Sell one put", cta: "Fill at the bid (paper)", body: `Settled USD ${usd(bal.usd)}. The reserve must be covered in USD.`,
    fields: [{ name: "strike", kind: "cards", label: "Put", options: cands.map((c) => ({ value: String(c.strike), label: `${c.strike} put · bid ${c.bid.toFixed(2)}`,
      meta: `reserve ${usd(c.strike * 100)} · ${pctS(c.yieldAnn)} annualised${c.belowHurdle ? " · below T-bill" : ""}`, tone: (c.strike * 100 > bal.usd ? "loss" : undefined) as FieldOption["tone"] })) }] });
  const put = cands.find((c) => String(c.strike) === String(sp.strike))!;
  step("PUT_FILLED");
  bal.usd += put.bid * 100; snap("put sold");
  if (put.strike * 100 > bal.usd) v.feedback.push({ tone: "loss", text: `Reserve ${usd(put.strike * 100)} exceeds settled USD ${usd(bal.usd)}. If assigned, the USD balance goes negative: a loan.` });
  const p1 = steerTo(gbm(rnd, 12, SPOT, 0, 0.03), roundCents(put.strike * 0.94));
  step("PUT_ASSIGNED");
  bal.usd -= put.strike * 100; bal.shares = 100; snap("assigned");
  const basis = roundCents(put.strike - put.bid);
  v.brief.basis = basis;
  v.path = { dates: weekDates("2026-09-07", p1.length), spot: p1, revealed: p1.length, marks: [{ week: 0, label: "sell put" }, { week: 12, label: "assigned" }], strike: put.strike };
  v.feedback.push({ tone: "info", text: `Fast-forward 12 weeks: QQQ ${p1.at(-1)!.toFixed(2)}, assigned at ${put.strike}. Decision basis ${usd(basis)}.` });
  const s1 = p1.at(-1)!;
  const strikes = [Math.floor(basis) - 20, Math.ceil(basis) + 1, Math.ceil(basis) + 20];
  const calls = strikes.map((K) => ({ K, bid: Math.max(0.05, roundCents(bsCall(s1, K, 84 / 365, RF, 0.26) * 0.985)) }));
  const sc = g.ask({ stage: "sell_call", title: "Sell one covered call", cta: "Fill at the bid (paper)", body: `100 shares, basis ${usd(basis)}.`,
    fields: [
      { name: "strike", kind: "cards", label: "Call", options: calls.map((x) => ({ value: String(x.K), label: `${x.K} call · bid ${x.bid.toFixed(2)}`,
        meta: x.K < basis ? "below basis · locked loss" : "at or above basis", tone: (x.K < basis ? "loss" : "ok") as FieldOption["tone"] })) },
      { name: "justification", kind: "textarea", label: "Why accept a locked loss?", minLength: 10, showIf: { field: "strike", equals: strikes.filter((K) => K < basis).map(String) } },
    ] });
  const call = calls.find((x) => String(x.K) === String(sc.strike))!;
  step("CALL_FILLED");
  bal.usd += call.bid * 100; snap("call sold");
  const p2 = steerTo(gbm(rnd, 12, s1, 0, 0.03), roundCents(Math.max(call.K * 1.03, s1)));
  v.path = { dates: weekDates("2026-09-07", p1.length + p2.length - 1), spot: [...p1, ...p2.slice(1)], revealed: p1.length + p2.length - 1,
    marks: [{ week: 0, label: "sell put" }, { week: 12, label: "assigned" }, { week: 24, label: "called away" }], strike: put.strike, callStrike: call.K };
  step("CALLED_AWAY");
  bal.usd += call.K * 100; bal.shares = 0; snap("called away");
  const minBal = Math.min(...v.balances.map((b) => Math.min(b.usd, b.hkd)));
  const noNeg = minBal >= 0;
  v.paperWheelCompleted = (wheel as CycleState) === "closed";
  v.evidence.push({ rule: "cash.paper_no_negative", passed: noNeg });
  const pnl = (put.bid + call.bid) * 100 + (call.K - put.strike) * 100;
  v.feedback.push({ tone: noNeg ? "ok" : "loss", text: noNeg ? "No currency balance went negative at any step." : `A balance went negative (${usd(minBal)}). That is a loan. Convert enough USD first next time.` },
    { tone: "info", text: `Cycle closed. Premiums ${usd((put.bid + call.bid) * 100)} USD; shares ${call.K >= put.strike ? "gained" : "lost"} ${usd(Math.abs(call.K - put.strike) * 100)} USD vs the put strike.` });
  const f = g.ask({ stage: "debrief", title: "Debrief", cta: "Finish the paper wheel", body: "The full wheel: cash → short put → shares → covered call → cash.",
    fields: [{ name: "lesson", kind: "textarea", label: "What would you do differently with real money?", minLength: 10 }] });
  void f;
  v.rubric = rubric([
    item("fx", "Converted enough USD before selling", 25, noNeg, noNeg ? "no loan" : "negative balance"),
    item("envelope", "Put inside the envelope", 20, put.inBand, "Beginner band"),
    item("hurdle", "Put above the T-bill hurdle", 15, !put.belowHurdle, put.belowHurdle ? "below T-bill" : "above"),
    item("basis", "Call at or above basis (or justified)", 25, call.K >= basis || String(sc.justification ?? "").length >= 10, call.K >= basis ? "≥ basis" : "justified locked loss"),
    item("sizing", "One lot", 15, true, "one lot"),
  ], pnl);
}

function tutorialMode(g: Runner) {
  g.view.brief = { spot: SPOT, rf: RF, dte: 84, envelope: "Beginner 5–12 %", ticket: { strike: 650, premium: 12.4, putCall: "P" } };
  const d = g.ask({ stage: "ticket", title: "Mock IBKR ticket", cta: "Finish tutorial", body: "Guided taps on a mock ticket.",
    fields: [{ name: "completed", kind: "radio", label: "Completed", options: [{ value: "yes", label: "yes" }] }] });
  void d;
  g.view.feedback.push({ tone: "ok", text: "Tutorial complete. Bid = sell; the preview says SELL put, LMT." });
}

// ------------------------------------------------------------------ entry point
export function replayGame(mode: GameMode, scenarioId: string, seed: number, decisions: readonly Decision[], opts: { startCashUsd?: number } = {}): GameView {
  const def = GAME_SCENARIOS.find((s) => s.id === scenarioId);
  const view: GameView = {
    mode, scenarioId, seed, title: def?.title ?? scenarioId, narrative: def?.narrative ?? "", finished: false, prompt: null,
    brief: { spot: SPOT, rf: RF, envelope: "Beginner 5–12 %" }, path: null, wheel: "none", balances: [], feedback: [], rubric: null, evidence: [], paperWheelCompleted: false,
  };
  const rnd = mulberry32(seed);
  const g = new Runner(decisions, view);
  try {
    if (mode === "scenario") {
      if (!def || def.mode !== "scenario") throw new GameInputError("UNKNOWN_SCENARIO");
      scenarioMode(g, rnd, def);
    } else if (mode === "paper_lab") paperLabMode(g, rnd, opts.startCashUsd ?? 100_000);
    else if (mode === "crash") {
      if (!CRASH_SCENARIOS[scenarioId]) throw new GameInputError("UNKNOWN_SCENARIO");
      crashMode(g, scenarioId);
    } else if (mode === "committee") { view.title = "Monthly committee"; view.narrative = "Build the packet, imagine failure, decide with a memo."; committeeMode(g, rnd); }
    else if (mode === "post_assign") { view.title = "After assignment"; view.narrative = "You own 100 QQQ below your strike. No panic: a covered call at or above basis."; postAssignMode(g, rnd); }
    else { view.title = "Tutorial: the ticket"; tutorialMode(g); }
    if (g.i < decisions.length) throw new GameInputError("Game already finished");
    view.finished = true;
  } catch (e) {
    if (e instanceof Pending) {
      view.prompt = e.prompt;
      if (!view.finished) { view.rubric = null; view.evidence = []; view.paperWheelCompleted = false; }
    } else throw e;
  }
  return view;
}

export const MODE_OF_ROUTE = { tutorial: "SCR-008", scenario: "SCR-009", crash: "SCR-010", committee: "SCR-011", post_assign: "SCR-012", paper_lab: "SCR-009" } as const;
