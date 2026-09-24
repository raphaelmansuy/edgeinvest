// Query key factory + query options: the only place keys are spelled (docs/08 §6).
import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "./api";
import type {
  AuditPage, CurriculumModule, DraftView, GameAttempt, GameCatalogItem, InputsView, JobView, LedgerView,
  LessonsView, MasteryView, MemoList, MemoView, ModuleSummary, QuizView, ResultRow, Scenarios, TicketView, VocabRun, WheelView,
} from "./shapes";

export const qk = {
  caps: ["me", "capabilities"] as const,
  me: ["me", "profile"] as const,
  disclosures: ["me", "disclosures"] as const,
  envelope: ["me", "envelope"] as const,
  curriculum: ["learn", "curriculum"] as const,
  module: (slug: string) => ["learn", "module", slug] as const,
  quiz: (m: string) => ["learn", "quiz", m] as const,
  vocab: ["learn", "vocab"] as const,
  ticket: ["learn", "ticket"] as const,
  mastery: ["learn", "mastery"] as const,
  games: ["game", "attempts"] as const,
  game: (id: string) => ["game", "attempt", id] as const,
  catalog: ["game", "catalog"] as const,
  lessons: ["journal", "lessons"] as const,
  scenarios: ["sim", "scenarios"] as const,
  results: (kind?: string) => ["sim", "results", kind ?? "all"] as const,
  job: (id: string) => ["sim", "job", id] as const,
  inputs: ["decide", "inputs"] as const,
  memos: (f: Record<string, string | undefined> = {}) => ["decide", "memos", f] as const,
  memosAll: ["decide", "memos"] as const,
  memo: (id: string) => ["decide", "memo", id] as const,
  draft: (id: string) => ["execute", "draft", id] as const,
  cycle: (id: string) => ["execute", "cycle", id] as const,
  wheel: ["execute", "wheel"] as const,
  ledger: (group: string) => ["journal", "ledger", group] as const,
  audit: (action?: string) => ["journal", "audit", action ?? "all"] as const,
  agent: ["agent", "status"] as const,
};

/** Prefixes that change together after a decide or execute mutation. */
export const AFTER_WHEEL = [["decide"], ["execute"], ["journal"], qk.caps, qk.mastery] as const;

export const capabilitiesQuery = () =>
  queryOptions({ queryKey: qk.caps, queryFn: () => unwrap(api.me.capabilities.$get()), staleTime: 30_000 });
export const meQuery = () => queryOptions({ queryKey: qk.me, queryFn: () => unwrap(api.me.$get()) });
export const disclosuresQuery = () => queryOptions({ queryKey: qk.disclosures, queryFn: () => unwrap(api.me.disclosures.$get()) });
export const envelopeQuery = () => queryOptions({ queryKey: qk.envelope, queryFn: () => unwrap(api.me.envelope.$get()) });

export const curriculumQuery = () =>
  queryOptions({ queryKey: qk.curriculum, queryFn: () => unwrap(api.curriculum.$get()) as Promise<ModuleSummary[]>, staleTime: Infinity });
export const moduleQuery = (slug: string) =>
  queryOptions({ queryKey: qk.module(slug), queryFn: () => unwrap(api.curriculum[":slug"].$get({ param: { slug } })) as Promise<CurriculumModule>, staleTime: Infinity });
export const quizQuery = (module: string) =>
  queryOptions({ queryKey: qk.quiz(module), queryFn: () => unwrap(api.quiz[":module"].$get({ param: { module } })) as Promise<QuizView> });
export const vocabQuery = () =>
  queryOptions({ queryKey: qk.vocab, queryFn: () => unwrap(api.learn.vocab.$get()) as Promise<VocabRun>, staleTime: Infinity });
export const ticketQuery = () =>
  queryOptions({ queryKey: qk.ticket, queryFn: () => unwrap(api.learn.tickets.$get()) as Promise<TicketView>, staleTime: Infinity });
export const masteryQuery = () => queryOptions({ queryKey: qk.mastery, queryFn: () => unwrap(api.mastery.$get()) as Promise<MasteryView> });
export const catalogQuery = () =>
  queryOptions({ queryKey: qk.catalog, queryFn: () => unwrap(api.game.catalog.$get()) as Promise<GameCatalogItem>, staleTime: Infinity });
export const gamesQuery = () => queryOptions({ queryKey: qk.games, queryFn: () => unwrap(api.game.attempts.$get()) as Promise<GameAttempt[]> });
export const gameQuery = (id: string) =>
  queryOptions({ queryKey: qk.game(id), queryFn: () => unwrap(api.game.attempts[":id"].$get({ param: { id } })) });
export const lessonsQuery = () => queryOptions({ queryKey: qk.lessons, queryFn: () => unwrap(api.lessons.$get()) as Promise<LessonsView> });

export const scenariosQuery = () =>
  queryOptions({ queryKey: qk.scenarios, queryFn: () => unwrap(api.sim.scenarios.$get()) as Promise<Scenarios>, staleTime: Infinity });
export const resultsQuery = (kind?: "crash" | "mc" | "backtest") =>
  queryOptions({ queryKey: qk.results(kind), queryFn: () => unwrap(api.sim.results.$get({ query: kind ? { kind } : {} })) as Promise<ResultRow[]> });
export const jobQuery = (id: string) =>
  queryOptions({ queryKey: qk.job(id), queryFn: () => unwrap(api.jobs[":id"].$get({ param: { id } })) as Promise<JobView> });

export const inputsQuery = () => queryOptions({ queryKey: qk.inputs, queryFn: () => unwrap(api.inputs.latest.$get()) as Promise<InputsView> });
export const memosQuery = (f: { phase?: "cash-put" | "shares-held"; decision?: "sell" | "skip" | "wait" | "cover_call" } = {}) =>
  queryOptions({ queryKey: qk.memos(f), queryFn: () => unwrap(api.memos.$get({ query: f })) as Promise<MemoList> });
export const memoQuery = (id: string) =>
  queryOptions({ queryKey: qk.memo(id), queryFn: () => unwrap(api.memos[":id"].$get({ param: { id } })) as Promise<MemoView> });
export const draftQuery = (id: string) =>
  queryOptions({ queryKey: qk.draft(id), queryFn: () => unwrap(api.drafts[":id"].$get({ param: { id } })) as Promise<DraftView> });
export const cycleQuery = (id: string) =>
  queryOptions({ queryKey: qk.cycle(id), queryFn: () => unwrap(api.cycles[":id"].$get({ param: { id } })) });
export const wheelQuery = () => queryOptions({ queryKey: qk.wheel, queryFn: () => unwrap(api.wheel.state.$get()) as Promise<WheelView> });

export const ledgerQuery = (group: "quarter" | "hk_yoa") =>
  queryOptions({ queryKey: qk.ledger(group), queryFn: () => unwrap(api.ledger.$get({ query: { group } })) as Promise<LedgerView> });
export const auditQuery = (action?: string) =>
  queryOptions({ queryKey: qk.audit(action), queryFn: () => unwrap(api.audit.$get({ query: { ...(action ? { action } : {}), limit: "40" } })) as Promise<AuditPage> });
export const agentStatusQuery = () => queryOptions({ queryKey: qk.agent, queryFn: () => unwrap(api.agent.status.$get()), staleTime: 60_000 });
