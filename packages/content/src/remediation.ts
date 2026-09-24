// Misconception taxonomy → remediation cards (docs/03 §8). A failed quiz opens the card before a retry (friction, not punishment).
export interface Remediation { id: string; misconception: string; card: string; retest: string; to: string }

export const REMEDIATION: Record<string, Remediation> = {
  "MC-01": { id: "MC-01", misconception: "Tap Ask to sell, or buying a put is the same as selling one",
    card: "Bid = sell, Ask = buy. Opening a cash-secured put is SELL to open at the bid. The preview must say SELL and put.", retest: "M1", to: "/learn/seven-words" },
  "MC-02": { id: "MC-02", misconception: "Premium is profit with no capital at risk",
    card: "Four numbers: reserve = strike × 100, max profit = premium × 100, break-even = strike − premium, worst case = reserve − max profit. The reserve is idle cash.", retest: "M3", to: "/learn/arithmetic" },
  "MC-03": { id: "MC-03", misconception: "~7–8 % is guaranteed or a floor",
    card: "Meeting numbers are illustrative. Simulations are sourced but not forecasts. Read the Monte Carlo fan: p05 is the planning case.", retest: "M7", to: "/simulate/monte-carlo" },
  "MC-04": { id: "MC-04", misconception: "HKD cash covers a USD put",
    card: "FX first. A negative USD or HKD balance is a loan. Convert deliberately before the reserve counts.", retest: "M2", to: "/learn/three-layer" },
  "MC-05": { id: "MC-05", misconception: "Further out of the money is always safer and better",
    card: "The safe-strike trap: a far strike pays less than a T-bill while keeping the crash risk. Stay in the band and apply the hurdle.", retest: "M4", to: "/learn/arithmetic" },
  "MC-06": { id: "MC-06", misconception: "Assignment is failure; sell the shares",
    card: "Assignment is a step in the wheel. Keep the shares; sell a call at or above your decision basis.", retest: "M5", to: "/learn/wheel" },
  "MC-07": { id: "MC-07", misconception: "Any call is fine to exit",
    card: "A call below basis locks in a loss if called away. That is a conscious, audited choice, never a default.", retest: "M5", to: "/learn/wheel" },
  "MC-08": { id: "MC-08", misconception: "Add lots to catch up",
    card: "One lot. Adding lots concentrates risk exactly when drawdowns are deepest. Replay dotcom with fill cash to see it.", retest: "M7", to: "/simulate/crash" },
  "MC-09": { id: "MC-09", misconception: "A quiet quarter × 4 is an annual return",
    card: "Returns are path dependent. Annualised figures from fewer than four quarters are hidden.", retest: "M7", to: "/execute/quarterly-ledger" },
  "MC-10": { id: "MC-10", misconception: "Assignment only happens at expiry",
    card: "QQQ options are American style: assignment can happen any day. Calls are most at risk just before ex-dividend dates.", retest: "M5", to: "/learn/wheel" },
};
