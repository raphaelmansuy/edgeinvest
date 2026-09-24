// View shapes for JSON the API returns from SQL (typed loosely at the boundary, strictly in screens).
import type { ClaimKind, RuleResultView } from "@edge/ui";
import type { GameView } from "@edge/content/game";

export interface ModuleSummary { code: string; slug: string; title: string; lead: string; scr: string; quiz: boolean }
export interface CurriculumModule extends ModuleSummary {
  content_version: number;
  sections: { id: string; heading: string; body: string; claim?: ClaimKind }[];
  sources: { title: string; url: string }[];
}

export interface QuizItem { id: string; kind: "choice" | "number"; prompt: string; choices?: string[]; unit?: string; tags: string[] }
export interface RemediationCard { id: string; misconception: string; card: string; retest: string; to: string }
export interface QuizView {
  module: string; title: string; seed: number; pass_threshold: number; items: QuizItem[];
  attempts: { attempt_id: string; score_pct: string | number; passed: boolean; created_at: string }[];
  remediation_required: RemediationCard[];
  last_attempt_id: string | null;
}
export interface VocabCard { word: string; definition: string; check: string; choices: string[] }
export interface VocabRun { seed: number; cards: VocabCard[]; total: number }
export interface TicketView { seed: number; strike: number; premium: number; expiry: string; text: string }

export interface MasteryRule { rule: string; label?: string; passed: boolean; attempts: number; text?: string }
export interface MasteryView {
  all_pass: boolean;
  all_passed_at: string | null;
  paper_wheel_completed_at: string | null;
  competencies: { id: string; status: "locked" | "in_progress" | "passed"; progress: number; rules: { rule: string; passed: boolean; attempts: number; label?: string }[] }[];
}

export interface GameCatalogItem {
  scenarios: { id: string; mode: string; title: string; narrative: string }[];
  crashes: { id: string; title: string; narrative: string }[];
}
export interface GameAttempt { attempt_id: string; mode: string; scenario_id: string; process_score: string | number | null; started_at: string; finished_at: string | null }
export interface GamePayload { attempt_id: string; view: GameView; finished_at?: string | null }

export interface LessonsView {
  items: { id: string; kind: string; ref: string; score?: string | number | null; passed?: boolean; note?: string | null; created_at: string; tags?: string[] | null }[];
  misconceptions: { id?: string; misconception?: string; count: number }[];
}

export interface Scenarios { crashes: { id: string; title: string; start: string; end: string }[] }
export interface ResultRow { result_id: string; kind: string; model_version: string; seed: number | null; params: Record<string, unknown>; claim_label: ClaimKind; created_at: string }
export interface JobView {
  job_id: string; kind: string; status: string; attempts: number; error: string | null; progress: string | number | null;
  result_id: string | null; summary: Record<string, unknown> | null; model_version: string | null; claim_label: ClaimKind | null;
}

export interface QuoteRow { quote_id: string; put_call: "P" | "C"; expiry: string; strike: string; bid: string | null; ask: string | null }
export interface InputsView {
  mode: "paper" | "live";
  account: { snapshot_id: string; as_of: string; usd_settled_cash: string; hkd_cash: string; nlv_usd: string | null; options_level: number; fx_loan_flag: boolean } | null;
  market: { market_snapshot_id: string; spot: string; as_of: string; source: string; ex_dividend_date: string | null; quotes: QuoteRow[] } | null;
  rate: { rate_id: string; kind: string; rate: string; as_of: string; source_url: string } | null;
}

export interface Candidate {
  candidate_id: string; quote_id: string; put_call: "P" | "C"; strike: string; expiry: string; dte: number;
  otm_pct: string; limit_price: string; reserve_usd: string; max_profit_usd: string; break_even: string; worst_case_usd: string;
  premium_yield_ann: string; score: string | null; rank: number | null; reject_reasons: string[];
}
export interface MemoView {
  memo: { memo_id: string; phase: "cash-put" | "shares-held"; status: string; decision: string | null; precommit_plan: string | null; rationale: string | null; envelope_id: string; decision_date: string };
  envelope: { id: string; label: string; otm_min: number; otm_max: number; dte_min: number; dte_max: number };
  candidates: Candidate[];
  unpriced: { quote_id: string; strike: string; expiry: string; bid: string | null; ask: string | null; reject_reasons: string[] }[];
  stress: { kind: "crash" | "mc"; result_id: string; headline: Record<string, unknown>; claim_label?: ClaimKind; model_version: string }[];
  packet: { has_crash: boolean; has_mc: boolean; packet_complete: boolean };
  skip: { code: string; note: string | null } | null;
  drafts: { draft_id: string; status: string; put_call: "P" | "C"; strike: string; expiry: string; limit_price: string; block_reasons: string[] }[];
  inputs: { account: InputsView["account"]; market: { spot: string; as_of: string; ex_dividend_date: string | null } | null; rate: { rate: number; as_of: string; cited: boolean; source_url?: string } | null };
  basis: { basis: string; qty: number; cycle_id: string } | null;
  frozen: boolean;
}
export interface MemoListItem {
  memo_id: string; decision_date: string; phase: string; status: string; decision: string | null; envelope_id: string; created_at: string;
  skip_code: string | null; skip_note: string | null;
  draft: { draft_id: string; status: string; put_call: "P" | "C"; strike: string; expiry: string } | null;
  top: { strike: string; expiry: string; put_call: "P" | "C"; limit_price: string } | null;
}
export interface MemoList { items: MemoListItem[]; next_cursor: string | null; quarter: { memos: number; skips: number } }

export interface DraftView {
  draft: {
    draft_id: string; memo_id: string | null; cycle_id: string | null; account_mode: "paper" | "live"; side: string; open_close: string;
    put_call: "P" | "C"; qty: number; strike: string; expiry: string; limit_price: string; order_type: string; tif: string; status: string;
    block_reasons: string[]; steps_done: string[]; checklist: { results?: RuleResultView[]; warnings?: string[] } | null;
  };
  memo: { memo_id: string; precommit_plan: string | null; phase: string; decision: string | null } | null;
  invariants: { kind: "put"; reserve: string; max_profit: string; break_even: string; worst_case: string } | { kind: "call"; shares_covered: number; credit: string; max_profit: string; worst_case: string; locked_loss: boolean; basis: string } | null;
  dte: number;
  market: { spot: string; as_of: string; ex_dividend_date: string | null } | null;
  steps: { id: string; group: string }[];
  steps_complete: boolean;
  fill: { leg_id: string; open_price: string; opened_at: string } | null;
}

export interface WheelView {
  mode: "paper" | "live"; phase: "cash-put" | "shares-held"; lots_open: number; lots_max: number; reserved_usd: string;
  halt: { reason: string; at: string | null; title?: string; body?: string; action?: string; to?: string } | null;
  willingness_confirmed_at: string | null;
  basis: { basis: string; qty: number; cycle_id: string } | null;
  cycles: { cycle_id: string; state: string; mode: string; opened_at: string; open_leg: { put_call: "P" | "C"; strike: string; expiry: string; open_price: string } | null }[];
  vetoes: { draft_id: string; put_call: "P" | "C"; strike: string; expiry: string; block_reasons: string[] }[];
  account: { as_of: string; settled: string; hkd: string; fx_loan: boolean; options_level: number } | null;
}

export interface LedgerEntry {
  entry_id: string; mode: string; cycle_id: string | null; kind: string; amount_usd: string; trade_date: string;
  quarter_label: string; hk_year_of_assessment: string; hk_note: string | null; badges_of_trade_flag: boolean;
}
export interface LedgerView {
  group: string;
  entries: LedgerEntry[];
  groups: { label: string; premium: string; debits: string; credits: string; rows: number }[];
  premium_received: string;
  quarters: number;
}
export interface AuditPage {
  items: { seq: string | number; action: string; actor: string; scr_id: string | null; payload: unknown; ts: string; chain_hash: string }[];
  next_before: number | null;
  actions: { action: string; n: number }[];
}
