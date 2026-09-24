// Approved copy v1 (docs/12 §2), verbatim. `**x**` marks emphasis rendered by <CopyText>.
// Changing any APPROVED block bumps COPY_VERSION and forces re-acknowledgement (docs/12 §4); CP-VERBATIM guards it.
export const COPY_VERSION = "v1";

export const APPROVED = {
  "edu.sticky":
    "Education and decision support — **not** personalized investment advice. Confirm live broker preview, permissions, and professional tax/legal advice for your situation.",
  "claim.meeting_7_8":
    "Meeting-sourced illustrative stack (premium + T-bill) ≈ 7–8% — **not a guarantee, not a floor.** Do not annualize one quiet quarter.",
  "claim.article_8_9": "Teaching target / UNCONFIRMED — not a floor. Past paths ≠ future.",
  "tax.not_advice":
    "This tax journal is **educational** for a Hong Kong personal book. It is **not tax advice**. No auto filing. Export for your adviser. Premium treatment under IRO s.14 is uncertain (badges of trade).",
  "sim.not_forecast": "Simulation, not a forecast. Model `{model_version}`, seed `{seed}`.",
  "exec.human_gate": "EdgeInvest never sends orders. You place the order yourself in IBKR, after checking the live preview.",
  "agent.not_advice": "The tutor explains numbers and rules. It is not a licensed adviser and cannot place orders.",
  "agent.refuse": "I can't tell you what to trade. I can show the numbers, the risks and what your packet still needs, so you can decide.",
  "agent.offline": "Agent offline. All safety checks still run.",
  "paper.bar": "SIMULATED — paper account",
  "quarter.no_annualise": "One quarter is not a year. Annualised figures from a single quarter are hidden.",
} as const;
export type ApprovedKey = keyof typeof APPROVED;

export const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));

export interface Disclosure {
  key: "edu.sticky" | "options.loss" | "no.orders" | "exec.human_gate" | "agent.not_advice" | "live.unlock" | "tax.not_advice";
  title: string;
  body: string;
  requiredFor: "onboarded" | "execute" | "agent" | "live" | "tax_export";
}

export const DISCLOSURES: readonly Disclosure[] = [
  { key: "edu.sticky", title: "This is education, not investment advice", body: APPROVED["edu.sticky"], requiredFor: "onboarded" },
  { key: "options.loss", title: "Options can lose more than the premium",
    body: "Selling a put obliges you to buy 100 shares per contract at the strike. If QQQ falls far below the strike, the loss can be many times the premium you collected — up to the strike × 100 minus the premium, per contract.",
    requiredFor: "onboarded" },
  { key: "no.orders", title: "This app never sends orders to any broker",
    body: "EdgeInvest prepares drafts and checklists only. There is no broker connection and no submit button. You type every order yourself in IBKR.",
    requiredFor: "onboarded" },
  { key: "exec.human_gate", title: "You place every order yourself", body: APPROVED["exec.human_gate"], requiredFor: "execute" },
  { key: "agent.not_advice", title: "The tutor is not an adviser", body: APPROVED["agent.not_advice"], requiredFor: "agent" },
  { key: "live.unlock", title: "Live mode uses your real account",
    body: "In Live mode drafts refer to real money in your IBKR account. Every safety rule still applies and you still place every order yourself. Re-confirm at each human gate.",
    requiredFor: "live" },
  { key: "tax.not_advice", title: "The HK tax journal is not tax advice", body: APPROVED["tax.not_advice"], requiredFor: "tax_export" },
];
export const ONBOARDING_DISCLOSURES = DISCLOSURES.filter((d) => d.requiredFor === "onboarded").map((d) => d.key);
export const EXECUTE_DISCLOSURES = DISCLOSURES.filter((d) => d.requiredFor === "execute").map((d) => d.key);

export const SKIP_REASONS = {
  premium_below_tbill: "Premium below the T-bill hurdle",
  otm_outside_envelope: "No strike inside my envelope",
  fx_imbalance: "FX / currency balance not clean",
  concentration: "Too concentrated already",
  crash_uncomfortable: "The crash replay made me uncomfortable",
  no_level3: "Options permission not in place",
  personal_discretion: "Personal discretion",
  other: "Other (note required)",
} as const;

export const HALT_TEXT: Record<string, { title: string; action: string; to: string }> = {
  second_lot_without_cash: { title: "A second lot was attempted without the cash for it", action: "Close or finish the open cycle first. lots_max stays 1.", to: "/execute/halt" },
  fx_loan: { title: "A negative currency balance (FX loan) was detected", action: "Convert in IBKR so no balance is negative, then capture a new account snapshot.", to: "/decide/inputs" },
  locked_loss_unsigned: { title: "A covered call below your decision basis needs your explicit acceptance", action: "Choose a strike at or above basis, or accept the locked loss below.", to: "/execute/halt" },
  willingness_declined: { title: "You said you are not willing to hold the shares through a further drawdown", action: "Re-affirm willingness on the Willingness screen when you are ready.", to: "/decide/willingness" },
  packet_incomplete: { title: "A draft was attempted without crash and Monte Carlo attached", action: "Attach both stress tests to the packet.", to: "/decide/history" },
  empty_chain: { title: "No usable quotes were available", action: "Capture a chain with bid and ask on Inputs.", to: "/decide/inputs" },
  level_gap: { title: "Options permission is below Level 3", action: "Upgrade the permission in IBKR, then capture a new account snapshot.", to: "/decide/inputs" },
  paper_bar_missing: { title: "The paper-account bar was not confirmed in the playbook", action: "Confirm you see the SIMULATED bar in IBKR on the playbook precheck.", to: "/execute/halt" },
};

/** UI microcopy that is not an approved block (still linted). */
export const UI = {
  appName: "EdgeInvest",
  tagline: "Learn, simulate, decide. You submit in IBKR.",
  prepare: "Prepare draft",
  skip: "Skip this month",
  wait: "Wait",
  coach: "Open IB preview coach",
  emptyChain: "No quote, refusing to invent one.",
  noMemos: "No memos yet. Skip is a valid decision.",
  maxProfitNote: "before fees",
  worstCase: "Worst case (QQQ → 0)",
  computedNotPromise: "computed, not a promise",
  errorNothingSent: "Something failed on our side. Nothing was sent to any broker.",
  offline: "You are offline. Changes are paused.",
  staleWrite: "This changed in another tab. The latest version is shown.",
  personalBook: "This is your personal book.",
} as const;
