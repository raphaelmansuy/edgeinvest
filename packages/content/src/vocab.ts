// Seven words (M1, SCR-002). Each card has one check question; distractors are seeded so answers do not transfer by position.
import { mulberry32, shuffle } from "@edge/domain";

export interface VocabCard { word: string; definition: string; check: string; answer: string; distractors: readonly string[]; tag: string }

export const SEVEN_WORDS: readonly VocabCard[] = [
  { word: "share", definition: "One unit of ownership. QQQ is an ETF share that tracks the Nasdaq-100.",
    check: "One QQQ option contract covers how many shares?", answer: "100", distractors: ["1", "10", "1,000"], tag: "MC-01" },
  { word: "put", definition: "A contract giving the buyer the right to sell 100 shares at the strike. The seller of the put must buy if asked.",
    check: "You sell a put. If assigned, you must…", answer: "buy 100 shares at the strike", distractors: ["sell 100 shares at the strike", "pay the premium back", "nothing, it expires"], tag: "MC-01" },
  { word: "call", definition: "A contract giving the buyer the right to buy 100 shares at the strike. The seller of a covered call must sell their shares if asked.",
    check: "You sell a covered call and are assigned. You…", answer: "deliver your 100 shares at the strike", distractors: ["buy 100 more shares", "keep the shares", "receive a second premium"], tag: "MC-06" },
  { word: "strike", definition: "The price at which you promise to buy (put) or sell (call).",
    check: "A 650 put obliges you to buy at…", answer: "650.00", distractors: ["721.11 (spot)", "12.40 (premium)", "637.60"], tag: "MC-02" },
  { word: "premium", definition: "The cash you receive today for making the promise. You keep it whatever happens.",
    check: "Premium 12.40 on one contract is…", answer: "1,240 USD received now", distractors: ["12.40 USD received now", "1,240 USD paid at expiry", "a guaranteed yearly return"], tag: "MC-02" },
  { word: "expiry", definition: "The last day the promise is valid. After it, an out-of-the-money option expires worthless.",
    check: "At expiry QQQ is above your put strike. The put…", answer: "expires worthless; you keep the premium", distractors: ["is assigned", "rolls automatically", "doubles the premium"], tag: "MC-10" },
  { word: "assignment", definition: "When the option buyer exercises, the seller must fulfil the promise. For QQQ this can happen any day before expiry.",
    check: "When can a short QQQ put be assigned?", answer: "any day until expiry", distractors: ["only on expiry day", "only if QQQ is above the strike", "never with one contract"], tag: "MC-10" },
];

export function vocabRun(seed: number) {
  const rnd = mulberry32(seed);
  return SEVEN_WORDS.map((c) => ({ word: c.word, definition: c.definition, check: c.check, choices: shuffle(rnd, [c.answer, ...c.distractors]) }));
}

export function gradeVocab(answers: Record<string, string>) {
  const correct = SEVEN_WORDS.filter((c) => answers[c.word] === c.answer).length;
  return { correct, total: SEVEN_WORDS.length, passed: correct >= 6, missed: SEVEN_WORDS.filter((c) => answers[c.word] !== c.answer).map((c) => ({ word: c.word, tag: c.tag })) };
}
