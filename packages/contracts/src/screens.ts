// Screen registry (docs/05 §1): single source for routes, guards, banners, e2e sweep and the trace gate.
export type Area = "auth" | "shell" | "learn" | "game" | "simulate" | "decide" | "share" | "execute" | "journal" | "agent" | "me";
export type Guard =
  | "public" | "authenticated" | "onboarded" | "phase_cash_put" | "phase_shares_held" | "open_short_put" | "open_cycle";
export type Banner = "footer" | "sticky" | "required" | "required_live";

interface ScreenDef {
  id: `SCR-${string}`;
  name: string;
  route: string;
  area: Area;
  guard: Guard;
  banner: Banner;
  stories: readonly string[];
  /** Redirect target when the guard is false; without one the screen renders its locked state. */
  fallback?: string;
  /** Shows ClaimLabel + claim blocks (docs/12 banner matrix). */
  claims?: boolean;
}

export const SCREEN_LIST = [
  { id: "SCR-100", name: "Sign in", route: "/sign-in", area: "auth", guard: "public", banner: "footer", stories: ["AUTH-1"] },
  { id: "SCR-101", name: "First run", route: "/welcome", area: "auth", guard: "authenticated", banner: "sticky", stories: ["AUTH-1"] },
  { id: "SCR-000", name: "Home", route: "/", area: "shell", guard: "authenticated", banner: "sticky", stories: ["US-2", "US-5"] },
  { id: "SCR-001", name: "Learn › WHY", route: "/learn/why", area: "learn", guard: "onboarded", banner: "sticky", stories: [] },
  { id: "SCR-002", name: "Learn › Seven words", route: "/learn/seven-words", area: "learn", guard: "onboarded", banner: "sticky", stories: ["US-1"] },
  { id: "SCR-003", name: "Learn › Three-layer", route: "/learn/three-layer", area: "learn", guard: "onboarded", banner: "sticky", stories: ["US-2"] },
  { id: "SCR-004", name: "Learn › CSP arithmetic", route: "/learn/arithmetic", area: "learn", guard: "onboarded", banner: "sticky", stories: ["US-1"] },
  { id: "SCR-005", name: "Learn › Wheel", route: "/learn/wheel", area: "learn", guard: "onboarded", banner: "sticky", stories: ["US-4"] },
  { id: "SCR-006", name: "Learn › Quizzes", route: "/learn/quizzes/$module", area: "learn", guard: "onboarded", banner: "sticky", stories: ["US-1"] },
  { id: "SCR-007", name: "Game hub", route: "/learn/game", area: "game", guard: "onboarded", banner: "sticky", stories: ["US-1", "US-3"] },
  { id: "SCR-008", name: "Game › Tutorial", route: "/learn/game/tutorial", area: "game", guard: "onboarded", banner: "sticky", stories: ["US-1"] },
  { id: "SCR-009", name: "Game › Scenario", route: "/learn/game/scenario/$scenarioId", area: "game", guard: "onboarded", banner: "sticky", stories: ["US-1"] },
  { id: "SCR-010", name: "Game › Crash", route: "/learn/game/crash/$scenarioId", area: "game", guard: "onboarded", banner: "sticky", stories: ["US-3"] },
  { id: "SCR-011", name: "Game › Committee", route: "/learn/game/committee", area: "game", guard: "onboarded", banner: "sticky", stories: ["US-7"] },
  { id: "SCR-012", name: "Game › Post-assign", route: "/learn/game/post-assign", area: "game", guard: "onboarded", banner: "sticky", stories: ["US-8"] },
  { id: "SCR-020", name: "Simulate › Payoff", route: "/simulate/payoff", area: "simulate", guard: "onboarded", banner: "sticky", stories: ["US-1"] },
  { id: "SCR-021", name: "Simulate › Crash", route: "/simulate/crash", area: "simulate", guard: "onboarded", banner: "sticky", stories: ["US-3"], claims: true },
  { id: "SCR-022", name: "Simulate › Monte Carlo", route: "/simulate/monte-carlo", area: "simulate", guard: "onboarded", banner: "sticky", stories: ["US-3"], claims: true },
  { id: "SCR-023", name: "Simulate › Backtest", route: "/simulate/backtest", area: "simulate", guard: "onboarded", banner: "sticky", stories: ["US-2", "US-3"], claims: true },
  { id: "SCR-102", name: "Decide › Inputs", route: "/decide/inputs", area: "decide", guard: "onboarded", banner: "sticky", stories: ["US-9"] },
  { id: "SCR-030", name: "Decide › Snapshot", route: "/decide/snapshot", area: "decide", guard: "onboarded", banner: "sticky", stories: ["US-3", "US-9"] },
  { id: "SCR-031", name: "Decide › Candidates", route: "/decide/candidates", area: "decide", guard: "phase_cash_put", banner: "sticky", stories: ["US-1", "US-2", "US-7"], fallback: "/decide/put-lock" },
  { id: "SCR-032", name: "Decide › Put packet", route: "/decide/packet/$memoId", area: "decide", guard: "onboarded", banner: "sticky", stories: ["US-3", "US-5", "US-7", "US-11"], claims: true },
  { id: "SCR-033", name: "Decide › History", route: "/decide/history", area: "decide", guard: "onboarded", banner: "sticky", stories: ["US-7"] },
  { id: "SCR-034", name: "Decide › Assignment", route: "/decide/assignment/$cycleId", area: "share", guard: "open_short_put", banner: "sticky", stories: ["US-8"], fallback: "/" },
  { id: "SCR-035", name: "Decide › Willingness", route: "/decide/willingness", area: "share", guard: "phase_shares_held", banner: "sticky", stories: ["US-8"] },
  { id: "SCR-036", name: "Decide › Call candidates", route: "/decide/call-candidates", area: "share", guard: "phase_shares_held", banner: "sticky", stories: ["US-8"] },
  { id: "SCR-037", name: "Decide › Call packet", route: "/decide/call-packet/$memoId", area: "share", guard: "phase_shares_held", banner: "sticky", stories: ["US-7", "US-8"], claims: true },
  { id: "SCR-038", name: "Decide › Call ticket", route: "/decide/call-ticket/$draftId", area: "share", guard: "phase_shares_held", banner: "sticky", stories: ["US-4", "US-8"] },
  { id: "SCR-039", name: "Decide › Put lock", route: "/decide/put-lock", area: "share", guard: "onboarded", banner: "sticky", stories: ["US-8"] },
  { id: "SCR-040", name: "Execute › Put playbook", route: "/execute/put-playbook/$draftId", area: "execute", guard: "phase_cash_put", banner: "required", stories: ["US-4"], fallback: "/decide/put-lock" },
  { id: "SCR-041", name: "Execute › Draft coach", route: "/execute/draft-coach/$draftId", area: "execute", guard: "onboarded", banner: "required", stories: ["US-5"] },
  { id: "SCR-042", name: "Execute › Human gate", route: "/execute/human-gate/$draftId", area: "execute", guard: "onboarded", banner: "required", stories: ["US-5"] },
  { id: "SCR-103", name: "Execute › Short-put life", route: "/execute/short-put-life/$cycleId", area: "execute", guard: "open_cycle", banner: "required", stories: ["US-10", "US-11"], fallback: "/" },
  { id: "SCR-043", name: "Execute › Call playbook", route: "/execute/call-playbook/$draftId", area: "execute", guard: "phase_shares_held", banner: "required", stories: ["US-4"] },
  { id: "SCR-044", name: "Execute › Short-call life", route: "/execute/short-call-life/$cycleId", area: "execute", guard: "phase_shares_held", banner: "required", stories: ["US-8"] },
  { id: "SCR-045", name: "Execute › Halt / veto", route: "/execute/halt", area: "execute", guard: "onboarded", banner: "required", stories: ["US-8"] },
  { id: "SCR-046", name: "Execute › Quarterly ledger", route: "/execute/quarterly-ledger", area: "execute", guard: "onboarded", banner: "sticky", stories: ["US-6"] },
  { id: "SCR-050", name: "Journal › Audit", route: "/journal/audit", area: "journal", guard: "onboarded", banner: "sticky", stories: ["US-5", "US-7"] },
  { id: "SCR-051", name: "Journal › HK tax", route: "/journal/tax-hk", area: "journal", guard: "onboarded", banner: "sticky", stories: ["US-6"] },
  { id: "SCR-052", name: "Journal › Lessons", route: "/journal/lessons", area: "journal", guard: "onboarded", banner: "sticky", stories: ["US-1"] },
  { id: "SCR-060", name: "Agent", route: "/agent", area: "agent", guard: "onboarded", banner: "required", stories: ["US-5", "US-12"] },
  { id: "SCR-070", name: "Me › Settings", route: "/me/settings", area: "me", guard: "authenticated", banner: "sticky", stories: [] },
  { id: "SCR-071", name: "Me › Envelope", route: "/me/envelope", area: "me", guard: "onboarded", banner: "sticky", stories: ["US-2"] },
  { id: "SCR-072", name: "Me › Mode", route: "/me/mode", area: "me", guard: "onboarded", banner: "required_live", stories: ["US-4", "US-5"] },
  { id: "SCR-073", name: "Me › Compliance", route: "/me/compliance", area: "me", guard: "authenticated", banner: "sticky", stories: ["US-6"] },
] as const satisfies readonly ScreenDef[];

export type ScrId = (typeof SCREEN_LIST)[number]["id"];
export interface Screen extends ScreenDef { id: ScrId }
export const SCREENS = Object.fromEntries(SCREEN_LIST.map((s) => [s.id, s])) as unknown as Readonly<Record<ScrId, Screen>>;
export const SCR_IDS = SCREEN_LIST.map((s) => s.id) as ScrId[];

/** Primary navigation (top bar). Order is the teaching order: learn before deciding. */
export const NAV = [
  { area: "learn", label: "Learn", to: "/learn/why" },
  { area: "simulate", label: "Simulate", to: "/simulate/payoff" },
  { area: "decide", label: "Decide", to: "/decide/inputs" },
  { area: "execute", label: "Execute", to: "/execute/halt" },
  { area: "journal", label: "Journal", to: "/journal/audit" },
  { area: "agent", label: "Agent", to: "/agent" },
] as const;

export const bannerOf = (scr: ScrId) => SCREENS[scr].banner;
export const screenByRoute = (route: string) => SCREEN_LIST.find((s) => s.route === route) as Screen | undefined;
