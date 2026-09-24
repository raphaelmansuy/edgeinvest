// Quiz item generators (docs/03 §4, §10): (seed) ⇒ items. Parameters are seeded so memorised answers do not transfer (EC-LN-001).
import { type Competency, formatUsd, fromDollars, intBetween, mulberry32, pick, shortPutInvariants, shuffle } from "@edge/domain";
export interface QuizItem {
  id: string;
  kind: "choice" | "number";
  prompt: string;
  choices?: string[];
  answer: string;
  unit?: string;
  tags: string[];
  /** Evidence rule fired when this single item is answered correctly (docs/03 §4 item-level rules). */
  itemRule?: string;
  explain: string;
}
export interface QuizDef { module: string; title: string; rule: string | null; competency: Competency | null; count: number; make: (rnd: () => number) => QuizItem[] }

const usd = (dollars: number) => formatUsd(fromDollars(dollars));
const strikes = [560, 580, 600, 620, 640, 650, 660, 680];

function ticket(rnd: () => number) {
  const strike = pick(rnd, strikes);
  const premium = intBetween(rnd, 650, 1650) / 100;
  const inv = shortPutInvariants({ strike: fromDollars(strike), premium: fromDollars(premium), qty: 1 });
  return { strike, premium, inv };
}
const feedback = (strike: number, premium: number) =>
  `Selling one QQQ ${strike} put for ${premium.toFixed(2)} reserves USD ${usd(strike * 100)} and creates a maximum profit of USD ${usd(premium * 100)}. Break-even USD ${usd(strike - premium)}. Below that, losses increase dollar-for-dollar with QQQ.`;

const choice = (rnd: () => number, id: string, prompt: string, answer: string, wrong: string[], tags: string[], explain: string, itemRule?: string): QuizItem =>
  ({ id, kind: "choice", prompt, choices: shuffle(rnd, [answer, ...wrong]), answer, tags, explain, itemRule });

export const QUIZZES: Record<string, QuizDef> = {
  M1: {
    module: "M1", title: "Seven words", rule: "vocab.quiz_m1", competency: "vocabulary", count: 5,
    make: (rnd) => {
      const t = ticket(rnd);
      return [
        choice(rnd, "m1.translate", `“Sell 1 QQQ ${t.strike} put at ${t.premium.toFixed(2)}” means…`,
          `I receive ${usd(t.premium * 100)} USD now and may have to buy 100 QQQ at ${t.strike}`,
          [`I pay ${usd(t.premium * 100)} USD for the right to sell 100 QQQ at ${t.strike}`, `I buy 100 QQQ now at ${t.strike}`, `I receive ${t.premium.toFixed(2)} USD and nothing else can happen`],
          ["MC-01"], feedback(t.strike, t.premium)),
        choice(rnd, "m1.side", "To sell a put in IBKR Mobile you tap…", "the put Bid", ["the put Ask", "the call Bid", "Buy on the ticket"], ["MC-01"],
          "Bid is where buyers wait, so you sell at the bid. Tapping the ask buys the put: the opposite trade."),
        choice(rnd, "m1.preview", "The preview for opening a cash-secured put must say…", "SELL, put, LMT", ["BUY, put, LMT", "SELL, call, MKT", "BUY, call, LMT"], ["MC-01"],
          "Opening a cash-secured put is SELL to open, a limit order. Anything else is blocked here."),
        choice(rnd, "m1.expiry", "Your put expires with QQQ above the strike. You…", "keep the premium; the obligation ends", ["must buy the shares", "must pay the premium back", "roll automatically"], ["MC-10"],
          "Out of the money at expiry, the put expires worthless and you keep the premium."),
        choice(rnd, "m1.assign", "Early assignment on a short QQQ put can happen…", "any trading day before expiry", ["only on expiry day", "never", "only if you ask for it"], ["MC-10"],
          "QQQ options are American style. Keep the reserve untouched for the whole life of the trade."),
      ];
    },
  },
  M2: {
    module: "M2", title: "Three-layer OS", rule: null, competency: "cash_discipline", count: 4,
    make: (rnd) => {
      const hkd = pick(rnd, [400_000, 550_000, 800_000]);
      const strike = pick(rnd, strikes);
      return [
        choice(rnd, "m2.fx_loan", `You hold HKD ${hkd.toLocaleString("en-US")} and 0 USD, then sell a ${strike} put that is assigned. Without converting first, your USD balance becomes…`,
          `negative: a USD loan of about ${usd(strike * 100)}`, ["zero; IBKR always converts HKD for free", "positive; the premium covers it", "unaffected; HKD counts as USD"], ["MC-04"],
          "HKD cash does not secure a USD put. A negative currency balance is a loan with interest. Convert first, deliberately.", "cash.fx_loan_item"),
        choice(rnd, "m2.order", "Which layer comes first?", "FX: convert to USD deliberately", ["The option overlay", "The T-bill core", "Any order is fine"], ["MC-04"],
          "FX first, then the treasury core that holds the reserve, then one small option overlay."),
        choice(rnd, "m2.stack", "The meeting's ~7–8 % stack of premium plus T-bill is…", "illustrative, not a guarantee and not a floor", ["a guaranteed floor", "the minimum you will earn", "a yearly promise from IBKR"], ["MC-03"],
          "Meeting numbers illustrate a stack. They are never a promise. The Monte Carlo fan shows the range."),
        choice(rnd, "m2.reserve", `Settled USD is ${usd(strike * 100 - 5_000)}. Can you open one ${strike} put?`, "No: settled USD is below the reserve",
          ["Yes: margin covers the gap", "Yes: the premium covers the gap", "Yes if HKD is available"], ["MC-08"],
          `The reserve is ${usd(strike * 100)} USD, settled, in USD. Anything less is not cash-secured.`),
      ];
    },
  },
  M3: {
    module: "M3", title: "CSP arithmetic", rule: "arith.quiz_m3", competency: "arithmetic", count: 5,
    make: (rnd) => {
      const t = ticket(rnd);
      const t2 = ticket(rnd);
      const num = (id: string, prompt: string, v: number, explain: string): QuizItem =>
        ({ id, kind: "number", prompt, answer: (Math.round(v * 100) / 100).toFixed(2), unit: "USD", tags: ["MC-02"], explain });
      return [
        num("m3.reserve", `Sell 1 QQQ ${t.strike} put at ${t.premium.toFixed(2)}. Reserve?`, t.strike * 100, feedback(t.strike, t.premium)),
        num("m3.maxprofit", `Same ticket. Max profit (before fees)?`, t.premium * 100, feedback(t.strike, t.premium)),
        num("m3.breakeven", `Same ticket. Break-even per share?`, t.strike - t.premium, feedback(t.strike, t.premium)),
        num("m3.worst", `Same ticket. Worst case if QQQ went to 0?`, t.strike * 100 - t.premium * 100, `Worst case = reserve − max profit = ${usd(t.strike * 100 - t.premium * 100)} USD.`),
        num("m3.expiry_pnl", `Sell 1 QQQ ${t2.strike} put at ${t2.premium.toFixed(2)}. QQQ closes at ${t2.strike - 40} on expiry and you are assigned. P&L versus the strike price, at that close?`,
          (t2.premium - 40) * 100, `Assigned at ${t2.strike}, marked at ${t2.strike - 40}: −4,000 on the shares plus ${usd(t2.premium * 100)} premium.`),
      ];
    },
  },
  M4: {
    module: "M4", title: "Strike and the T-bill hurdle", rule: null, competency: "strike_selection", count: 4,
    make: (rnd) => {
      const spot = pick(rnd, [700, 721.11, 740]);
      const rf = pick(rnd, [0.0368, 0.0378, 0.042]);
      return [
        choice(rnd, "m4.band_beginner", "The Beginner envelope places put strikes…", "5–12 % below spot, 60–120 days", ["16–30 % below spot", "at the money, weekly", "anywhere, any expiry"], ["MC-05"],
          "Beginner is the default: 5–12 % OTM, 60–120 DTE, one lot.", "strike.band_quiz"),
        choice(rnd, "m4.band_mentor", "The Mentor envelope is…", "16–30 % below spot, unlocked after mastery", ["5–12 % below spot, the default", "any strike, no unlock", "calls only"], ["MC-05"],
          "Mentor is further out of the money and needs all six competencies and the paper wheel.", "strike.band_quiz"),
        choice(rnd, "m4.hurdle", `A put pays ${((rf - 0.012) * 100).toFixed(2)} % annualised; the 13-week T-bill is ${(rf * 100).toFixed(2)} %. You…`, "skip: the premium is below the hurdle",
          ["sell two lots to make up the gap", "sell: any premium is profit", "wait for the T-bill to fall"], ["MC-05"],
          "Below the T-bill you take equity crash risk for less than a risk-free rate. Skip is the job."),
        choice(rnd, "m4.otm", `Spot is ${spot}. Which strike is inside the Beginner band?`, String(Math.round(spot * 0.92)),
          [String(Math.round(spot * 0.8)), String(Math.round(spot * 0.99)), String(Math.round(spot * 0.7))], ["MC-05"],
          `Beginner is 5–12 % below ${spot}: roughly ${Math.round(spot * 0.88)} to ${Math.round(spot * 0.95)}.`),
      ];
    },
  },
  M5: {
    module: "M5", title: "Wheel and covered calls", rule: null, competency: null, count: 4,
    make: (rnd) => {
      const strike = pick(rnd, strikes);
      const premium = intBetween(rnd, 800, 1400) / 100;
      const basis = strike - premium;
      return [
        choice(rnd, "m5.basis", `Assigned on a ${strike} put sold at ${premium.toFixed(2)}. Your decision basis is…`, usd(basis), [usd(strike), usd(strike + premium), usd(premium)], ["MC-06"],
          "Decision basis = strike − premium received in this cycle."),
        choice(rnd, "m5.cc", `Basis ${usd(basis)}. Which covered-call strike keeps the cycle loss-free if called away?`, String(Math.ceil(basis / 10) * 10 + 10),
          [String(Math.floor(basis / 10) * 10 - 20), String(Math.floor(basis / 10) * 10 - 40), String(Math.floor(basis / 10) * 10 - 60)], ["MC-07"],
          "A call at or above basis. Below basis locks in a loss and needs your explicit acceptance."),
        choice(rnd, "m5.dump", "Right after assignment the disciplined move is…", "keep the shares and plan a call at or above basis", ["sell the shares immediately", "buy another 100 to average down", "open a second put"], ["MC-06", "MC-08"],
          "Assignment is a step in the wheel. One lot: no new put while shares are held."),
        choice(rnd, "m5.exdiv", "A short call is most likely to be assigned early…", "just before an ex-dividend date", ["on the first day", "never before expiry", "only when QQQ falls"], ["MC-10"],
          "Holders exercise in-the-money calls early to capture the dividend."),
      ];
    },
  },
  M7: {
    module: "M7", title: "Stress literacy", rule: "risk.quiz_m7", competency: "risk", count: 5,
    make: (rnd) => {
      const p05 = intBetween(rnd, 70, 88) * 1000;
      return [
        choice(rnd, "m7.guarantee", "Is ~7–8 % guaranteed?", "No: it is an illustrative meeting number", ["Yes, IBKR guarantees it", "Yes, it is a floor", "Yes, if you hold one lot"], ["MC-03"],
          "Nothing here is guaranteed. The meeting figure is illustrative, not a floor."),
        choice(rnd, "m7.p05", `After 5 years the Monte Carlo shows p05 = ${usd(p05)} on 100,000 start. This means…`, `about 1 path in 20 ends at or below ${usd(p05)}`,
          [`you will end at ${usd(p05)}`, `the worst possible outcome is ${usd(p05)}`, `the average outcome is ${usd(p05)}`], ["MC-03"],
          "p05 is a bad but plausible path. It is not the worst case."),
        choice(rnd, "m7.annualise", "A quiet quarter returned 1.9 %. Multiplying by 4 gives…", "a misleading number; one quarter is not a year", ["the annual return", "a conservative estimate", "a floor for next year"], ["MC-09"],
          "Returns are path dependent. Annualised figures from one quarter are hidden here."),
        choice(rnd, "m7.dd", "Maximum drawdown measures…", "the deepest fall from a peak", ["the average loss", "the premium collected", "the loss at expiry only"], ["MC-03"],
          "A small average loss can hide a very deep drawdown."),
        choice(rnd, "m7.lots", "After a drawdown, adding lots to catch up…", "raises concentration exactly when risk is highest", ["is how the strategy is meant to work", "is safe with a limit order", "reduces risk"], ["MC-08"],
          "One lot. The dotcom replay with fill cash shows why."),
      ];
    },
  },
};

export const QUIZ_MODULES = Object.keys(QUIZZES);
export const PASS_THRESHOLD = 80;

export function quizItems(module: string, seed: number): QuizItem[] {
  const def = QUIZZES[module];
  if (!def) throw new RangeError(`UNKNOWN_MODULE ${module}`);
  return def.make(mulberry32(seed));
}

/** The client never receives answers or explanations before grading (server-side grading, EC-LN-005). */
export const publicItems = (items: QuizItem[]) => items.map(({ answer: _a, explain: _e, itemRule: _r, ...rest }) => rest);

export function gradeQuiz(module: string, seed: number, answers: Record<string, string>) {
  const items = quizItems(module, seed);
  const results = items.map((it) => {
    const given = (answers[it.id] ?? "").trim();
    const ok = it.kind === "number" ? normaliseNumber(given) === it.answer : given === it.answer;
    return { id: it.id, correct: ok, given, answer: it.answer, explain: it.explain, tags: it.tags, itemRule: it.itemRule };
  });
  const score = Math.round((results.filter((r) => r.correct).length / items.length) * 10_000) / 100;
  const missedTags = [...new Set(results.filter((r) => !r.correct).flatMap((r) => r.tags))];
  return { score, passed: score >= PASS_THRESHOLD, results, missedTags };
}

function normaliseNumber(s: string) {
  const clean = s.replace(/[,\s]/g, "").replace(/^USD/i, "").replace(/^−/, "-");
  if (!/^-?\d+(\.\d{1,4})?$/.test(clean)) return null;
  return (Math.round(Number(clean) * 100) / 100).toFixed(2);
}
