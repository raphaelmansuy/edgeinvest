// SCR-004 practice tickets (C-ARITH-1): seeded tickets; three distinct seeds with all four numbers exact to the cent.
import { fromDollars, intBetween, mulberry32, pick, shortPutInvariants, toDecimalString } from "@edge/domain";

export function arithmeticTicket(seed: number) {
  const rnd = mulberry32(seed);
  const strike = pick(rnd, [560, 580, 600, 620, 640, 650, 660, 680]);
  const premium = intBetween(rnd, 650, 1650) / 100;
  const expiry = pick(rnd, ["2026-11-20", "2026-12-18", "2027-01-15"]);
  return { seed, strike, premium, expiry, text: `Sell 1 QQQ ${expiry.slice(0, 7)} ${strike} put at ${premium.toFixed(2)}` };
}

export const TICKET_FIELDS = ["reserve", "max_profit", "break_even", "worst_case"] as const;

export function gradeTicket(seed: number, answers: Record<string, string>) {
  const t = arithmeticTicket(seed);
  const inv = shortPutInvariants({ strike: fromDollars(t.strike), premium: fromDollars(t.premium), qty: 1 });
  const want = { reserve: inv.reserve, max_profit: inv.maxProfit, break_even: inv.breakEven, worst_case: inv.worstCase };
  const results = TICKET_FIELDS.map((k) => {
    const raw = String(answers[k] ?? "").replace(/[,\s]/g, "");
    const ok = /^-?\d+(\.\d{1,4})?$/.test(raw) && Math.round(Number(raw) * 100) === Math.round(want[k] / 100);
    return { field: k, ok, want: toDecimalString(want[k]) };
  });
  return { ticket: t, results, passed: results.every((r) => r.ok) };
}
