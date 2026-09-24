// Request schemas shared by API validation, web forms (TanStack Form) and agent tools (z.toJSONSchema). DRY hotspot (docs/07 §7).
import { ENVELOPE_IDS, ISO_DATE, isCentTick, MONEY_PATTERN, parseUsd4 } from "@edge/domain";
import * as z from "zod";

export const Money = z.string().trim().regex(MONEY_PATTERN, "Use digits with up to 4 decimals, e.g. 12.40");
export const MoneyPos = Money.refine((s) => Number(s) > 0, "Must be greater than 0");
export const Cents = MoneyPos.refine((s) => isCentTick(parseUsd4(s)), "Use the 0.01 tick");
export const IsoDate = z.string().regex(ISO_DATE, "Use YYYY-MM-DD");
export const Instant = z.iso.datetime({ offset: true });
export const Uuid = z.uuid();
export const EnvelopeId = z.enum(ENVELOPE_IDS);
export const PutCall = z.enum(["P", "C"]);
export const Ratio = z.string().regex(/^-?\d{1,2}(\.\d{1,6})?$/, "Decimal fraction, e.g. 0.0378");

export const SignInReq = z.object({ email: z.email().max(254), password: z.string().min(1).max(512) });
export const PatchMeReq = z.object({
  display_name: z.string().trim().max(80).nullable().optional(),
  jurisdiction: z.string().regex(/^[A-Z]{2}$/).optional(),
  paper_start_cash: MoneyPos.optional(),
  theme: z.enum(["system", "light", "dark"]).optional(),
});
export const AckReq = z.object({ copy_version: z.string().min(1).max(10), scr: z.string().regex(/^SCR-\d{3}$/).optional() });
export const EnvelopeReq = z.object({ envelope_id: EnvelopeId, override: z.boolean().default(false), confirm_phrase: z.string().optional() });
export const ModeReq = z.object({ mode: z.enum(["paper", "live"]), confirm_phrase: z.string().optional() });
export const OVERRIDE_PHRASE = "I accept the Mentor band without mastery";
export const LIVE_PHRASE = "LIVE real money";
export const FILL_CASH_PHRASE = "fill cash is dangerous";
export const LOCKED_LOSS_PHRASE = "I accept a locked loss";

export const InvariantsReq = z.object({
  put_call: PutCall,
  strike: MoneyPos.describe("Strike in USD, e.g. 650"),
  premium: MoneyPos.describe("Premium per share in USD, e.g. 12.40"),
  qty: z.number().int().min(1).max(10).describe("Contracts (1 contract = 100 shares)"),
  cost_basis: MoneyPos.optional().describe("Decision basis per share, covered calls only"),
});
export const PayoffReq = InvariantsReq.extend({ spot: MoneyPos });

export const CrashReq = z.object({
  scenario_id: z.string().min(1).max(40),
  envelope_id: EnvelopeId.default("beginner_v1"),
  otm_pct: Ratio.optional(),
  start_cash: MoneyPos.optional(),
  max_contracts: z.number().int().min(1).max(10).default(1),
  fill_cash: z.boolean().default(false),
  fill_cash_confirm: z.string().optional(),
  wheel: z.boolean().default(true),
  reserve_earns_rf: z.boolean().default(true),
  scale_to_spot: z.boolean().default(true),
});
export const McReq = z.object({
  envelope_id: EnvelopeId.default("beginner_v1"),
  paths: z.number().int().min(100).max(20_000).default(10_000),
  quarters: z.number().int().min(1).max(40).default(20),
  seed: z.number().int().min(0).max(2 ** 31 - 1).default(20260828),
  max_contracts: z.number().int().min(1).max(10).default(1),
  sizing_mode: z.enum(["willingness", "fill_cash"]).default("willingness"),
  fill_cash: z.boolean().default(false),
  fill_cash_confirm: z.string().optional(),
  otm_pct: Ratio.optional(),
  rf_rate_id: Uuid.nullable().optional(),
  reserve_earns_rf: z.boolean().default(true),
  wheel: z.boolean().default(false),
  start_cash: MoneyPos.optional(),
  iv: Ratio.optional(),
});
export const BacktestReq = z.object({
  envelope_id: EnvelopeId.default("beginner_v1"),
  otm_pct: Ratio.optional(),
  start: IsoDate.default("2010-01-01"),
  end: IsoDate.default("2026-08-31"),
  start_cash: MoneyPos.default("100000"),
  wheel: z.boolean().default(true),
});

export const AccountSnapshotReq = z.object({
  mode: z.enum(["paper", "live"]),
  as_of: Instant,
  usd_settled_cash: Money,
  hkd_cash: Money.default("0"),
  nlv_usd: Money.nullable().optional(),
  options_level: z.number().int().min(0).max(4),
});
export const QuoteIn = z.object({
  put_call: PutCall,
  expiry: IsoDate,
  strike: MoneyPos,
  bid: Money.nullable(),
  ask: MoneyPos.nullable(),
  non_standard: z.boolean().default(false),
});
export const MarketSnapshotReq = z.object({
  spot: MoneyPos,
  as_of: Instant,
  source: z.enum(["manual", "fixture"]).default("manual"),
  ex_dividend_date: IsoDate.nullable().optional(),
  quotes: z.array(QuoteIn).max(400),
});
export const RateReq = z.object({
  kind: z.enum(["tbill_4w", "tbill_13w", "idle_cash", "sgov_sec"]),
  rate: Ratio,
  as_of: IsoDate,
  source_url: z.url().regex(/^https:\/\//, "Cite an https source"),
});

export const CreateMemoReq = z.object({ phase: z.enum(["cash-put", "shares-held"]).optional() });
export const AttachStressReq = z.object({ result_id: Uuid });
export const SkipReq = z.object({
  code: z.enum(["premium_below_tbill", "otm_outside_envelope", "fx_imbalance", "concentration", "crash_uncomfortable", "no_level3", "personal_discretion", "other"]),
  note: z.string().trim().max(500).optional(),
}).refine((v) => v.code !== "other" || (v.note?.length ?? 0) >= 3, { message: "Add a short note (3+ characters)", path: ["note"] });
export const DecideReq = z.object({
  decision: z.enum(["sell", "wait", "cover_call"]),
  precommit_plan: z.string().trim().max(1000).optional(),
  rationale: z.string().trim().max(1000).optional(),
}).refine((v) => v.decision === "wait" || (v.precommit_plan?.length ?? 0) >= 10,
  { message: "Write your plan for a sharp drop (10+ characters)", path: ["precommit_plan"] });

export const DraftReq = z.object({
  memo_id: Uuid.optional(),
  candidate_id: Uuid.optional(),
  cycle_id: Uuid.optional(),
  side: z.enum(["SELL", "BUY"]),
  open_close: z.enum(["open", "close"]),
  put_call: PutCall,
  qty: z.number().int().min(1).max(10),
  strike: MoneyPos,
  expiry: IsoDate,
  limit_price: MoneyPos,
  order_type: z.string().default("LMT"),
  tif: z.enum(["DAY", "GTC"]).default("DAY"),
  precommit_plan: z.string().trim().max(1000).optional(),
});
export const StepReq = z.object({ step: z.string().min(1).max(40), done: z.boolean() });
export const HumanGateReq = z.object({ confirm: z.literal(true), live_phrase: z.string().optional() });
export const FillReq = z.object({ price: Cents, filled_at: Instant });
export const LifecycleReq = z.discriminatedUnion("event", [
  z.object({ event: z.literal("expired"), at: Instant }),
  z.object({ event: z.literal("bought_back"), at: Instant, price: Cents }),
  z.object({ event: z.literal("assigned"), at: Instant }),
  z.object({ event: z.literal("called_away"), at: Instant }),
  z.object({ event: z.literal("shares_sold"), at: Instant, price: Cents }),
  z.object({ event: z.literal("rolled"), at: Instant, close_price: Cents, open_strike: MoneyPos, open_expiry: IsoDate, open_price: Cents }),
]);
export const WillingnessReq = z.object({ willing: z.boolean(), statement: z.string().max(300).optional() });
export const LockedLossReq = z.object({ cycle_id: Uuid, phrase: z.literal(LOCKED_LOSS_PHRASE) });
export const AnnotationReq = z.object({ hk_note: z.string().max(2000).nullable(), badges_of_trade_flag: z.boolean() });
export const QuizAttemptReq = z.object({ seed: z.number().int().min(0), answers: z.record(z.string(), z.string().max(200)) });
export const GameStartReq = z.object({ scenario_id: z.string().min(1).max(60), mode: z.enum(["tutorial", "scenario", "crash", "committee", "post_assign", "paper_lab"]) });
export const GameStepReq = z.object({ decision: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])), finish: z.boolean().default(false) });
export const AgentChatReq = z.object({
  message: z.string().trim().min(1).max(2000),
  mode: z.enum(["ask", "ticket", "packet", "drill"]).default("ask"),
  conversation_id: Uuid.optional(),
  scr: z.string().regex(/^SCR-\d{3}$/).optional(),
  context_id: Uuid.optional(),
});

export type SignInReq = z.infer<typeof SignInReq>;
export type McReq = z.infer<typeof McReq>;
export type CrashReq = z.infer<typeof CrashReq>;
export type DraftReq = z.infer<typeof DraftReq>;
export type LifecycleReq = z.infer<typeof LifecycleReq>;
export type MarketSnapshotReq = z.infer<typeof MarketSnapshotReq>;
