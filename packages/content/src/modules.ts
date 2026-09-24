// Curriculum M0–M9 (docs/03 §9). One source for the Learn screens, the tutor's search_curriculum tool and RAG chunks (DRY).
export const CONTENT_VERSION = 1;

export type ClaimTag = "illustrative_meeting" | "sourced_sim" | "unconfirmed";
export interface Section { id: string; heading: string; body: string; claim?: ClaimTag }
export interface Module {
  code: `M${number}`;
  slug: string;
  title: string;
  lead: string;
  scr: string;
  sections: readonly Section[];
  sources: readonly { title: string; url: string }[];
}

const IBKR_LEVELS = { title: "IBKR options trading permissions", url: "https://www.interactivebrokers.com/campus/trading-lessons/options-trading-permissions/" };
const OCC_ODD = { title: "OCC: Characteristics and Risks of Standardized Options", url: "https://www.theocc.com/company-information/documents-and-archives/options-disclosure-document" };
const TREASURY = { title: "US Treasury daily bill rates", url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_bill_rates" };
const IRD = { title: "HK IRD: profits tax, badges of trade (DIPN 61)", url: "https://www.ird.gov.hk/eng/ppr/dipn.htm" };

export const MODULES: readonly Module[] = [
  {
    code: "M0", slug: "why", scr: "SCR-001", title: "Why this strategy",
    lead: "Premium and discipline, not a lottery ticket.",
    sections: [
      { id: "paid-to-promise", heading: "You are paid now to promise to buy lower",
        body: "Selling a cash-secured put means someone pays you a **premium** today. In exchange you promise to buy 100 QQQ shares at the **strike** if they ask before expiry. You keep the premium either way." },
      { id: "promise-is-risk", heading: "The promise is the risk",
        body: "The cash that backs the promise, strike × 100, must sit in USD, settled, untouched: the **reserve**. If QQQ falls far below the strike you still buy at the strike. The loss can be many times the premium." },
      { id: "shape", heading: "Small and frequent up, rare and big down",
        body: "Most months the put expires and you keep a small premium. Rarely, the market falls hard and you own shares at a price above the market. The whole method exists to make that rare month survivable: one lot, cash first, a written plan." },
      { id: "forced-dip", heading: "A forced buy-the-dip",
        body: "People who say they will buy the dip often freeze when it comes. A short put buys the dip for you, at a price you chose calmly in advance. That is only good if you would genuinely be happy to own QQQ at that price through a further drawdown." },
    ],
    sources: [OCC_ODD],
  },
  {
    code: "M1", slug: "seven-words", scr: "SCR-002", title: "Seven words",
    lead: "Share, put, call, strike, premium, expiry, assignment. If you can say these in your own words, you can read any ticket.",
    sections: [
      { id: "ticket-sentence", heading: "Translate a ticket into a sentence",
        body: "“Sell 1 QQQ 650 put at 12.40, expiry 20 Nov 2026” means: I receive 1,240 USD now, and until 20 Nov I may be asked to buy 100 QQQ at 650 each (65,000 USD)." },
      { id: "bid-ask", heading: "Bid is where you sell",
        body: "The **bid** is the best price a buyer offers; the **ask** is the best price a seller wants. You sell at the bid. Tapping the ask means buying, which is the opposite trade. Your preview must say **SELL**." },
    ],
    sources: [OCC_ODD],
  },
  {
    code: "M2", slug: "three-layer", scr: "SCR-003", title: "Three-layer operating system",
    lead: "FX first, treasury core second, the option overlay last and small.",
    sections: [
      { id: "layer-fx", heading: "Layer 1: FX, deliberately and first",
        body: "Convert HKD to USD yourself, before anything else. IBKR does not always auto-convert: holding HKD and committing USD can create a **negative USD balance, which is a loan** with interest. A negative balance in any currency blocks every draft here." },
      { id: "layer-treasury", heading: "Layer 2: the treasury core",
        body: "The reserve is cash. Cash can sit in T-bills or earn interest on idle USD, but only what you actually hold counts. Rates move: the app shows a rate only with a date and a source you cite." },
      { id: "layer-overlay", heading: "Layer 3: the option overlay",
        body: "One short put, fully secured by layer 2. The overlay is small on purpose. The meeting illustrated a stack of premium plus T-bill of about 7–8 %, which is **illustrative, not a guarantee and not a floor**.",
        claim: "illustrative_meeting" },
    ],
    sources: [TREASURY],
  },
  {
    code: "M3", slug: "arithmetic", scr: "SCR-004", title: "Cash-secured put arithmetic",
    lead: "Four numbers before any preview: reserve, max profit, break-even, worst case.",
    sections: [
      { id: "reserve", heading: "Reserve = strike × 100 × contracts", body: "A 650 put reserves 65,000 USD. That cash is idle for the whole life of the trade." },
      { id: "max-profit", heading: "Max profit = premium × 100 × contracts", body: "A premium of 12.40 gives 1,240 USD, before fees. It is the best case, not the typical case." },
      { id: "break-even", heading: "Break-even = strike − premium", body: "650 − 12.40 = 637.60 per share. Below this, every dollar QQQ falls is a dollar you lose." },
      { id: "worst-case", heading: "Worst case = reserve − max profit", body: "If QQQ went to zero: 65,000 − 1,240 = 63,760 USD lost. Unlikely is not impossible; the number is shown so you can say it out loud." },
    ],
    sources: [OCC_ODD],
  },
  {
    code: "M4", slug: "strike-hurdle", scr: "SCR-031", title: "Strike selection and the T-bill hurdle",
    lead: "Further out of the money is not automatically safer, and a premium below the T-bill is not worth the risk.",
    sections: [
      { id: "envelopes", heading: "Two envelopes",
        body: "Beginner (default): strikes 5–12 % below spot, 60–120 days. Mentor: 16–30 % below spot, 60–120 days, unlocked only after mastery. Both keep one lot." },
      { id: "hurdle", heading: "The T-bill hurdle",
        body: "Compare the premium's annualised rate with the T-bill rate you could earn with no option risk. If the premium is below the hurdle, **skip**. Annualising is for this comparison only; it is not a return." },
      { id: "safe-strike-trap", heading: "The safe-strike trap",
        body: "A very far strike pays so little that you take equity crash risk for less than a T-bill. It feels safe and is the worst trade in the table." },
    ],
    sources: [TREASURY],
  },
  {
    code: "M5", slug: "wheel", scr: "SCR-005", title: "The wheel and covered calls",
    lead: "Assignment is a step in the cycle, not a failure.",
    sections: [
      { id: "assigned", heading: "If you are assigned",
        body: "You now hold 100 QQQ. Do not dump them. Your decision basis is the put strike minus the premium you received." },
      { id: "cc-basis", heading: "Covered call at or above basis",
        body: "Sell one call 60–120 days out with a strike **at or above your basis**. Being called away then closes the cycle without a loss. A strike below basis locks in a loss and needs your explicit acceptance." },
      { id: "early", heading: "Early assignment",
        body: "QQQ options are American style: assignment can happen any day, not only at expiry. Calls are more likely to be assigned early just before an ex-dividend date." },
      { id: "one-lot", heading: "One lot at a time",
        body: "While shares are held, no new put. Called away returns you to cash and the put phase." },
    ],
    sources: [OCC_ODD],
  },
  {
    code: "M6", slug: "ibkr-mobile", scr: "SCR-040", title: "IBKR Mobile lab",
    lead: "Every tap, in order, on the paper account first.",
    sections: [
      { id: "paper-bar", heading: "Paper first", body: "Log in to the paper account. The yellow SIMULATED TRADING bar must be visible before anything else." },
      { id: "level", heading: "Permissions", body: "Cash-secured puts need options Level 3; covered calls need Level 1." },
      { id: "preview", heading: "The preview is the last check", body: "Side Sell, quantity 1, type LMT, price near the bid, TIF DAY. The preview must say SELL and put. You submit in IBKR; EdgeInvest never does." },
    ],
    sources: [IBKR_LEVELS],
  },
  {
    code: "M7", slug: "stress", scr: "SCR-021", title: "Stress literacy",
    lead: "Read a distribution, not a promise.",
    sections: [
      { id: "percentiles", heading: "p05, p50, p95",
        body: "p50 is the middle path. p05 is a bad path that happens about one time in twenty. Plan around p05, not p50." },
      { id: "drawdown", heading: "Maximum drawdown", body: "The deepest fall from a peak. A strategy with a small average loss can still have a very large drawdown." },
      { id: "no-guarantee", heading: "No promises",
        body: "No number here is a promise. The article target of 8–9 % is **UNCONFIRMED and not a floor**. One quiet quarter × 4 is not an annual return.",
        claim: "unconfirmed" },
    ],
    sources: [OCC_ODD],
  },
  {
    code: "M8", slug: "hk-tax", scr: "SCR-051", title: "Hong Kong tax awareness",
    lead: "Know the uncertainty; export the facts for an adviser.",
    sections: [
      { id: "no-cgt", heading: "What is known", body: "Hong Kong has no capital-gains tax, and option premium is not salaries income." },
      { id: "badges", heading: "What is uncertain",
        body: "If the activity looks like a trade (badges of trade), profits tax under IRO s.14 may apply. There is no published ruling on cash-secured put premium. The journal records facts and your notes; it gives no verdict." },
    ],
    sources: [IRD],
  },
  {
    code: "M9", slug: "committee", scr: "SCR-011", title: "Monthly committee",
    lead: "Sell, skip or wait, with a memo. Skip is a decision.",
    sections: [
      { id: "memo", heading: "The memo", body: "Numbers, crash replay, Monte Carlo, the T-bill comparison and a written plan for a sharp drop, before any draft exists." },
      { id: "premortem", heading: "Premortem", body: "Before deciding, write what would make this trade go wrong. If the answer is uncomfortable, skipping is the job." },
    ],
    sources: [],
  },
];

export const moduleBySlug = (slug: string) => MODULES.find((m) => m.slug === slug);
export const moduleByCode = (code: string) => MODULES.find((m) => m.code === code);
