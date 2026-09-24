// IBKR Mobile playbooks (docs/05 SCR-040/043, docs/03 M6). Step ids are validated by the API; text is shown by the web.
// The app never opens or drives IBKR: the user performs every step (OPEN-5).
export interface PlaybookDraft { putCall: "P" | "C"; qty: number; strike: string; expiry: string; limit: string; dte: number; mode: "paper" | "live" }
export interface PlaybookStep { id: string; group: "precheck" | "steps"; text: (d: PlaybookDraft) => string; paperOnly?: boolean }

const exp = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" });

export const PUT_PLAYBOOK: readonly PlaybookStep[] = [
  { id: "pre.paper_bar", group: "precheck", paperOnly: true, text: () => "IBKR shows the red SIMULATED TRADING bar (paper login)" },
  { id: "pre.level", group: "precheck", text: () => "Options permission is Level 3 or higher" },
  { id: "pre.cash", group: "precheck", text: (d) => `USD settled cash covers the reserve (${Number(d.strike) * 100 * d.qty} USD)` },
  { id: "pre.no_negative", group: "precheck", text: () => "No negative balance in any currency (no FX loan)" },
  { id: "s1.quote", group: "steps", text: () => "Watchlists → QQQ → Quote Details" },
  { id: "s2.expiry", group: "steps", text: (d) => `Options → expiry ${exp(d.expiry)} (${d.dte} DTE, ET calendar)` },
  { id: "s3.strike", group: "steps", text: (d) => `Puts (right side) → strike ${d.strike}` },
  { id: "s4.bid", group: "steps", text: () => "Tap the PUT BID (bid = you sell · ask = you buy)" },
  { id: "s5.ticket", group: "steps", text: (d) => `Ticket: SELL · Qty ${d.qty} · LMT ${d.limit} · DAY` },
  { id: "s6.preview", group: "steps", text: () => "Preview shows SELL · PUT · a credit · the cash reserve" },
];

export const CALL_PLAYBOOK: readonly PlaybookStep[] = [
  { id: "pre.paper_bar", group: "precheck", paperOnly: true, text: () => "IBKR shows the red SIMULATED TRADING bar (paper login)" },
  { id: "pre.level", group: "precheck", text: () => "Options permission is Level 1 or higher" },
  { id: "pre.shares", group: "precheck", text: (d) => `You hold ${d.qty * 100} QQQ shares (covered)` },
  { id: "s1.position", group: "steps", text: () => "Portfolio → QQQ → Options (or Wizard → Protect a Position → Covered Call)" },
  { id: "s2.expiry", group: "steps", text: (d) => `Expiry ${exp(d.expiry)} (${d.dte} DTE) · strike ${d.strike}` },
  { id: "s3.bid", group: "steps", text: () => "Tap the CALL BID (bid = you sell)" },
  { id: "s4.ticket", group: "steps", text: (d) => `Ticket: SELL · Qty ${d.qty} · LMT ${d.limit} · DAY` },
  { id: "s5.preview", group: "steps", text: (d) => `Preview shows SELL · CALL · a credit · ${d.qty * 100} shares covered` },
];

export const playbookFor = (putCall: "P" | "C", mode: "paper" | "live") =>
  (putCall === "P" ? PUT_PLAYBOOK : CALL_PLAYBOOK).filter((s) => !s.paperOnly || mode === "paper");

/** Human gate checklist (SCR-042): the user confirms what the live IBKR preview showed. */
export const HUMAN_GATE_CHECKS = (d: PlaybookDraft) => [
  { id: "g.preview", text: `Preview showed SELL · ${d.putCall === "P" ? "PUT" : "CALL"} · QQQ · ${exp(d.expiry)} · ${d.strike} · LMT ${d.limit}` },
  { id: "g.numbers", text: d.putCall === "P" ? `Preview credit ≈ ${(Number(d.limit) * 100 * d.qty).toFixed(0)} and reserve ${Number(d.strike) * 100 * d.qty} match` : `Preview credit ≈ ${(Number(d.limit) * 100 * d.qty).toFixed(0)} and ${d.qty * 100} shares covered` },
  { id: "g.plan", text: "My plan for a sharp move is written" },
  { id: "g.mode", text: d.mode === "paper" ? "The IBKR login is the paper account (SIMULATED bar visible)" : "The IBKR login is my live account and I intend real money" },
];
