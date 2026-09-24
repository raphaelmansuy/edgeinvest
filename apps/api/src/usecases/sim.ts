// Calculators and simulations (E1/E4; docs/10). Results are immutable and deduplicated on identical inputs.
import { FILL_CASH_PHRASE } from "@edge/contracts";
import { ENVELOPES, type EnvelopeId, coveredCallInvariants, parseUsd4, shortPutInvariants, toDecimalString } from "@edge/domain";
import {
  BACKTEST_MODEL_VERSION, CRASH_MODEL_VERSION, CRASH_SCENARIOS, type CrashResult, DATASET_VERSION, MC_MODEL_VERSION, type McSummary, QUARTERLY,
  breakEvenOf, payoffGrid,
} from "@edge/sim";
import { jcs, sha256hex } from "../adapters/pg";
import type { Deps, Tx } from "../ports";
import { problem } from "../problem";

const DEFAULT_SPOT = 721.11;
export const DEFAULT_RF = { rate: 0.0378, as_of: "2026-08-27", kind: "tbill_13w", source_url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates", cited: false };
const SIM_TIMEOUT_MS = 2000;

export function calcInvariants(i: { put_call: "P" | "C"; strike: string; premium: string; qty: number; cost_basis?: string }) {
  try {
    const strike = parseUsd4(i.strike), premium = parseUsd4(i.premium);
    if (i.put_call === "P") {
      const r = shortPutInvariants({ strike, premium, qty: i.qty });
      return { kind: "put" as const, reserve: toDecimalString(r.reserve), max_profit: toDecimalString(r.maxProfit), break_even: toDecimalString(r.breakEven),
        worst_case: toDecimalString(r.worstCase), note: "max profit is before fees" };
    }
    if (!i.cost_basis) throw problem("VALIDATION_FAILED", "cost_basis is required for a covered call", { errors: [{ pointer: "/cost_basis", message: "Required for calls" }] });
    const r = coveredCallInvariants({ strike, premium, qty: i.qty, costBasis: parseUsd4(i.cost_basis) });
    return { kind: "call" as const, shares_covered: r.sharesCovered, credit: toDecimalString(r.creditOnly), max_profit: toDecimalString(r.maxProfit),
      worst_case: toDecimalString(r.worstCase), locked_loss: r.lockedLoss, note: "max profit if called away, before fees" };
  } catch (e) {
    if (e instanceof RangeError) throw problem("VALIDATION_FAILED", ({ PREMIUM_GE_STRIKE: "Premium must be below the strike", QTY_INVALID: "Quantity must be a whole number ≥ 1" } as Record<string, string>)[e.message] ?? e.message);
    throw e;
  }
}

export function payoff(i: { put_call: "P" | "C"; strike: string; premium: string; qty: number; spot: string; cost_basis?: string }) {
  const inv = calcInvariants(i);
  const base = { strike: Number(i.strike), premium: Number(i.premium), qty: i.qty, spot: Number(i.spot) };
  const input = i.put_call === "P" ? { kind: "put" as const, ...base } : { kind: "call" as const, ...base, basis: Number(i.cost_basis) };
  return { model_version: "payoff-v1", invariants: inv, break_even: breakEvenOf(input), points: payoffGrid(input) };
}

async function latestSpot(tx: Tx) {
  const [m] = await tx.sql`select spot, as_of from app.market_snapshot order by as_of desc limit 1`;
  return m ? { spot: Number(m.spot), as_of: m.as_of as Date, source: "your latest market snapshot" } : { spot: DEFAULT_SPOT, as_of: null, source: "teaching spot (28 Aug 2026)" };
}
export async function latestRate(tx: Tx, rateId?: string | null) {
  const [r] = rateId
    ? await tx.sql`select rate, as_of, kind, source_url from app.rate_snapshot where rate_id = ${rateId}`
    : await tx.sql`select rate, as_of, kind, source_url from app.rate_snapshot where kind in ('tbill_13w','tbill_4w') order by as_of desc, created_at desc limit 1`;
  if (rateId && !r) throw problem("NOT_FOUND", "Rate not found");
  return r ? { rate: Number(r.rate), as_of: String(r.as_of instanceof Date ? r.as_of.toISOString().slice(0, 10) : r.as_of), kind: r.kind, source_url: r.source_url, cited: true } : DEFAULT_RF;
}

function otmFor(envelopeId: EnvelopeId, otm?: string) {
  const e = ENVELOPES[envelopeId];
  if (otm === undefined) return Math.round(((e.otmMin + e.otmMax) / 2) * 10_000) / 10_000;
  const x = Number(otm);
  if (x < e.otmMin || x > e.otmMax) throw problem("VALIDATION_FAILED", `OTM must be inside ${e.label} (${e.otmMin * 100}–${e.otmMax * 100} %)`, { errors: [{ pointer: "/otm_pct", message: "Outside the envelope band" }] });
  return x;
}

async function fillCashGate(tx: Tx, fill: boolean, phrase: string | undefined, scr: string) {
  if (!fill) return;
  if (phrase !== FILL_CASH_PHRASE) throw problem("VALIDATION_FAILED", `Type "${FILL_CASH_PHRASE}" to enable fill cash`, { errors: [{ pointer: "/fill_cash_confirm", message: "Typed confirmation required" }] });
  await tx.audit({ action: "fill_cash_enabled", scr: scr as never, payload: { scr } });
}

type StressKind = "crash" | "mc" | "backtest";
const CLAIM: Record<StressKind, string> = { crash: "sourced_sim", mc: "sourced_sim", backtest: "unconfirmed" };

export async function storeResult(tx: Tx, kind: StressKind, model: string, seed: number | null, params: object, summary: object) {
  const hash = `sha256:${sha256hex(jcs({ kind, model, params }))}`;
  const [existing] = await tx.sql`select result_id, created_at from app.stress_result where kind = ${kind} and model_version = ${model} and input_hash = ${hash}`;
  if (existing) return { result_id: existing.result_id as string, dedup: true };
  const [row] = await tx.sql`insert into app.stress_result (user_id, kind, model_version, seed, input_hash, params, summary, claim_label)
                              values (${tx.userId}, ${kind}, ${model}, ${seed}, ${hash}, ${params}, ${summary}, ${CLAIM[kind]}) returning result_id`;
  return { result_id: row.result_id as string, dedup: false };
}

export async function runCrash(d: Deps, tx: Tx, r: { scenario_id: string; envelope_id: EnvelopeId; otm_pct?: string; start_cash?: string; max_contracts: number; fill_cash: boolean; fill_cash_confirm?: string; wheel: boolean; reserve_earns_rf: boolean; scale_to_spot: boolean }) {
  if (!CRASH_SCENARIOS[r.scenario_id]) throw problem("UNKNOWN_SCENARIO", `Scenarios: ${Object.keys(CRASH_SCENARIOS).join(", ")}`);
  await fillCashGate(tx, r.fill_cash, r.fill_cash_confirm, "SCR-021");
  const spot = await latestSpot(tx);
  const params = {
    scenarioId: r.scenario_id, otm: otmFor(r.envelope_id, r.otm_pct), startCash: Number(r.start_cash ?? 150000), maxContracts: r.max_contracts,
    fillCash: r.fill_cash, wheel: r.wheel, reserveEarnsRf: r.reserve_earns_rf, ...(r.scale_to_spot ? { scaleToSpot: spot.spot } : {}),
  };
  const result = await d.sim.run<CrashResult>("crash", params, SIM_TIMEOUT_MS);
  const stored = await storeResult(tx, "crash", CRASH_MODEL_VERSION, null, { ...params, envelope_id: r.envelope_id }, result);
  await tx.audit({ action: "sim_run", scr: "SCR-021", payload: { kind: "crash", scenario: r.scenario_id, result_id: stored.result_id, dedup: stored.dedup } });
  return { ...stored, model_version: CRASH_MODEL_VERSION, claim_label: "sourced_sim", params, spot_source: spot.source, result };
}

export async function runMc(d: Deps, tx: Tx, r: { envelope_id: EnvelopeId; paths: number; quarters: number; seed: number; max_contracts: number; sizing_mode: string; fill_cash: boolean; fill_cash_confirm?: string; otm_pct?: string; rf_rate_id?: string | null; reserve_earns_rf: boolean; wheel: boolean; start_cash?: string; iv?: string }) {
  const fill = r.fill_cash || r.sizing_mode === "fill_cash";
  await fillCashGate(tx, fill, r.fill_cash_confirm, "SCR-022");
  const spot = await latestSpot(tx);
  const rf = await latestRate(tx, r.rf_rate_id);
  const params = {
    quarterlyReturns: QUARTERLY.returns, paths: r.paths, quarters: r.quarters, seed: r.seed, otm: otmFor(r.envelope_id, r.otm_pct), rf: rf.rate,
    iv: r.iv ? Number(r.iv) : QUARTERLY.iv_default, startCash: Number(r.start_cash ?? 100000), spot: spot.spot, maxContracts: r.max_contracts,
    fillCash: fill, reserveEarnsRf: r.reserve_earns_rf, wheel: r.wheel,
  };
  const t0 = performance.now();
  const summary = await d.sim.run<McSummary>("mc", params, SIM_TIMEOUT_MS);
  const ms = Math.round(performance.now() - t0);
  const { quarterlyReturns: _q, ...shown } = params;
  const stored = await storeResult(tx, "mc", MC_MODEL_VERSION, r.seed, { ...shown, dataset: DATASET_VERSION, envelope_id: r.envelope_id }, summary);
  await tx.audit({ action: "sim_run", scr: "SCR-022", payload: { kind: "mc", seed: r.seed, paths: r.paths, result_id: stored.result_id, dedup: stored.dedup } });
  return { ...stored, model_version: MC_MODEL_VERSION, dataset: DATASET_VERSION, claim_label: "sourced_sim", params: shown, rf, spot_source: spot.source, ms, summary };
}

export async function queueBacktest(tx: Tx, r: { envelope_id: EnvelopeId; otm_pct?: string; start: string; end: string; start_cash: string; wheel: boolean }) {
  if (r.start >= r.end) throw problem("VALIDATION_FAILED", "Start must be before end", { errors: [{ pointer: "/end", message: "After start" }] });
  const payload = { otm: otmFor(r.envelope_id, r.otm_pct), startCash: Number(r.start_cash), maxContracts: 1, start: r.start, end: r.end, wheel: r.wheel, envelope_id: r.envelope_id };
  const hash = `sha256:${sha256hex(jcs({ kind: "backtest", model: BACKTEST_MODEL_VERSION, params: payload }))}`;
  const [done] = await tx.sql`select result_id from app.stress_result where kind = 'backtest' and model_version = ${BACKTEST_MODEL_VERSION} and input_hash = ${hash}`;
  const [job] = await tx.sql`insert into app.job (user_id, kind, payload, status, result_id, updated_at)
                              values (${tx.userId}, 'backtest', ${payload}, ${done ? "succeeded" : "queued"}, ${done?.result_id ?? null}, now()) returning job_id, status`;
  await tx.audit({ action: "backtest_queued", scr: "SCR-023", payload: { job: job.job_id, dedup: Boolean(done) } });
  return { job_id: job.job_id as string, status: job.status as string };
}

export async function getJob(tx: Tx, id: string) {
  const [j] = await tx.sql`select j.job_id, j.kind, j.status, j.attempts, j.error, j.payload, j.created_at, j.updated_at, j.progress,
                                  r.result_id, r.summary, r.model_version, r.claim_label
                             from app.job j left join app.stress_result r on r.result_id = j.result_id where j.job_id = ${id}`;
  if (!j) throw problem("NOT_FOUND");
  return j;
}

export async function getResult(tx: Tx, id: string) {
  const [r] = await tx.sql`select * from app.stress_result where result_id = ${id}`;
  if (!r) throw problem("NOT_FOUND");
  return r;
}
export async function listResults(tx: Tx, kind?: string) {
  return kind
    ? tx.sql`select result_id, kind, model_version, seed, params, claim_label, created_at from app.stress_result where kind = ${kind} order by created_at desc limit 20`
    : tx.sql`select result_id, kind, model_version, seed, params, claim_label, created_at from app.stress_result order by created_at desc limit 20`;
}
