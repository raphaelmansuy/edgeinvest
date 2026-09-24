// Practice-book accounts shown on the sign-in screen when the API is started with DEV_SIGNIN=1 (`make dev`).
// Emails stay in lockstep with the persona seed. This file has no other imports so the API can load it safely.

export const DEV_PASSWORD = "paper-wheel-2026";

export const DEV_PERSONAS = [
  { id: "newbie", email: "newbie@edge.test", name: "New", blurb: "Signed up, not onboarded" },
  { id: "learner", email: "learner@edge.test", name: "Lee", blurb: "Learning in progress" },
  { id: "putter", email: "putter@edge.test", name: "Pat", blurb: "A complete put packet", recommended: true },
  { id: "drafter", email: "drafter@edge.test", name: "Dana", blurb: "An open put draft" },
  { id: "shortput", email: "shortput@edge.test", name: "Sam", blurb: "A filled short put" },
  { id: "holder", email: "holder@edge.test", name: "Hana", blurb: "Shares held, call memo" },
  { id: "caller", email: "caller@edge.test", name: "Cai", blurb: "A covered-call draft" },
  { id: "halted", email: "halted@edge.test", name: "Hal", blurb: "A halt and a locked-loss veto" },
  { id: "master", email: "master@edge.test", name: "Max", blurb: "Mastery passed, several quarters" },
] as const;
