// Decide: inputs (cite-or-refuse), memos, candidates, stress attachment, skip / decide (E3; docs/02 §4, docs/05 §5–6).
import { ENVELOPES, exchangeDate, parseUsd4, scoreCandidates, toDecimalString } from "@edge/domain";
import { textArray } from "../adapters/pg";
import type { Deps, Tx } from "../ports";
import { problem } from "../problem";
import { loadWheelContext, raiseHalt } from "./context";
import { latestRate } from "./sim";

const money = (v: number | null) => (v === null ? null : toDecimalString(v as never));

// ------------------------------------------------------------------ inputs
export async function captureAccount(tx: Tx, r: { mode: "paper" | "live"; as_of: string; usd_settled_cash: string; hkd_cash: string; nlv_usd?: string | null; options_level: number }) {
  if (new Date(r.as_of).getTime() > Date.now() + 5 * 60_000) throw problem("VALIDATION_FAILED", "The snapshot time is in the future", { errors: [{ pointer: "/as_of", message: "Not in the future" }] });
  const [row] = await tx.sql`insert into app.account_snapshot (user_id, mode, as_of, nlv_usd, usd_settled_cash, hkd_cash, options_level, source)
                              values (${tx.userId}, ${r.mode}, ${r.as_of}, ${r.nlv_usd ?? null}, ${r.usd_settled_cash}, ${r.hkd_cash}, ${r.options_level}, 'manual')
                              returning snapshot_id, fx_loan_flag`;
  await tx.audit({ action: "inputs_captured", scr: "SCR-102", payload: { kind: "account", snapshot: row.snapshot_id, mode: r.mode } });
  let halted = false;
  if (row.fx_loan_flag) halted = await raiseHalt(tx, "fx_loan", { snapshot: row.snapshot_id, usd_settled_cash: r.usd_settled_cash, hkd_cash: r.hkd_cash }, "SCR-102");
  else if (r.options_level < 3) {
    const w = await loadWheelContext(tx);
    if (w.phase === "cash-put") halted = await raiseHalt(tx, "level_gap", { snapshot: row.snapshot_id, options_level: r.options_level }, "SCR-102");
  }
  return { snapshot_id: row.snapshot_id as string, fx_loan: Boolean(row.fx_loan_flag), halt_raised: halted };
}

export async function captureMarket(tx: Tx, r: { spot: string; as_of: string; source: string; ex_dividend_date?: string | null; quotes: { put_call: "P" | "C"; expiry: string; strike: string; bid: string | null; ask: string | null; non_standard: boolean }[] }) {
  const asOf = new Date(r.as_of);
  if (asOf.getTime() > Date.now() + 5 * 60_000) throw problem("VALIDATION_FAILED", "Quotes cannot be from the future", { errors: [{ pointer: "/as_of", message: "Not in the future" }] });
  const errors: { pointer: string; message: string }[] = [];
  const seen = new Set<string>();
  const today = exchangeDate(asOf);
  r.quotes.forEach((q, i) => {
    if (q.bid !== null && q.ask !== null && Number(q.bid) > Number(q.ask)) errors.push({ pointer: `/quotes/${i}/bid`, message: "Crossed quote: bid above ask" });
    if (q.non_standard) errors.push({ pointer: `/quotes/${i}/non_standard`, message: "Non-standard deliverable refused" });
    if (q.expiry <= today) errors.push({ pointer: `/quotes/${i}/expiry`, message: "Expiry must be after the quote date (ET)" });
    const k = `${q.put_call}|${q.expiry}|${Number(q.strike)}`;
    if (seen.has(k)) errors.push({ pointer: `/quotes/${i}/strike`, message: "Duplicate row" });
    seen.add(k);
  });
  if (errors.length) throw problem(errors.some((e) => e.pointer.endsWith("non_standard")) ? "NON_STANDARD_DELIVERABLE" : "VALIDATION_FAILED", errors[0]!.message, { errors });
  const [snap] = await tx.sql`insert into app.market_snapshot (user_id, spot, as_of, source, ex_dividend_date)
                               values (${tx.userId}, ${r.spot}, ${r.as_of}, ${r.source}, ${r.ex_dividend_date ?? null}) returning market_snapshot_id`;
  for (const q of r.quotes) {
    await tx.sql`insert into app.option_quote (market_snapshot_id, put_call, expiry, strike, bid, ask)
                 values (${snap.market_snapshot_id}, ${q.put_call}, ${q.expiry}, ${q.strike}, ${q.bid}, ${q.ask})`;
  }
  await tx.audit({ action: "inputs_captured", scr: "SCR-102", payload: { kind: "market", snapshot: snap.market_snapshot_id, quotes: r.quotes.length } });
  if (r.quotes.length === 0 || r.quotes.every((q) => q.bid === null || Number(q.bid) === 0)) {
    return { market_snapshot_id: snap.market_snapshot_id as string, usable_quotes: 0 };
  }
  return { market_snapshot_id: snap.market_snapshot_id as string, usable_quotes: r.quotes.filter((q) => q.bid !== null && Number(q.bid) > 0).length };
}

export async function captureRate(tx: Tx, r: { kind: string; rate: string; as_of: string; source_url: string }) {
  const [row] = await tx.sql`insert into app.rate_snapshot (user_id, kind, rate, as_of, source_url)
                              values (${tx.userId}, ${r.kind}, ${r.rate}, ${r.as_of}, ${r.source_url}) returning rate_id`;
  await tx.audit({ action: "inputs_captured", scr: "SCR-102", payload: { kind: "rate", rate_id: row.rate_id, source_url: r.source_url } });
  return { rate_id: row.rate_id as string };
}

async function marketById(tx: Tx, id: string | null) {
  const [m] = id
    ? await tx.sql`select market_snapshot_id, spot, as_of, source, ex_dividend_date::text as ex_dividend_date from app.market_snapshot where market_snapshot_id = ${id}`
    : await tx.sql`select market_snapshot_id, spot, as_of, source, ex_dividend_date::text as ex_dividend_date from app.market_snapshot order by as_of desc, created_at desc limit 1`;
  if (!m) return null;
  const quotes = await tx.sql`select quote_id, put_call, expiry::text as expiry, strike, bid, ask from app.option_quote
                               where market_snapshot_id = ${m.market_snapshot_id} order by put_call, expiry, strike`;
  return { ...m, quotes };
}

export async function latestInputs(tx: Tx) {
  const w = await loadWheelContext(tx);
  const [acct] = await tx.sql`select snapshot_id, mode, as_of, usd_settled_cash, hkd_cash, nlv_usd, options_level, fx_loan_flag
                                from app.account_snapshot where mode = ${w.mode} order by as_of desc, created_at desc limit 1`;
  const [rate] = await tx.sql`select rate_id, kind, rate, as_of::text as as_of, source_url from app.rate_snapshot order by as_of desc, created_at desc limit 1`;
  return { mode: w.mode, account: acct ?? null, market: await marketById(tx, null), rate: rate ?? null };
}

// ------------------------------------------------------------------ memos
async function memoRow(tx: Tx, id: string, forUpdate = false) {
  const [m] = forUpdate
    ? await tx.sql`select * from app.decision_memo where memo_id = ${id} and deleted_at is null for update`
    : await tx.sql`select * from app.decision_memo where memo_id = ${id} and deleted_at is null`;
  if (!m) throw problem("NOT_FOUND", "Memo not found");
  return m;
}
async function activeDraft(tx: Tx, memoId: string) {
  const [d] = await tx.sql`select draft_id, status from app.draft_preview where memo_id = ${memoId}
                             and status in ('open','approved','submitted_by_user') order by created_at desc limit 1`;
  return d ?? null;
}
export async function assertBuilding(tx: Tx, memoId: string) {
  const m = await memoRow(tx, memoId, true);
  if (await activeDraft(tx, memoId)) throw problem("MEMO_FROZEN", "A draft exists for this memo. Discard it to change the packet.");
  if (m.status !== "building") throw problem("MEMO_FROZEN", "This memo is decided.");
  return m;
}

/** Decision basis of the open share lot (null in the cash-put phase). */
export async function openBasis(tx: Tx) {
  const [l] = await tx.sql`select l.cost_basis, l.qty, c.cycle_id from app.share_lot l join app.wheel_cycle c using (cycle_id)
                            where l.closed_at is null and c.state <> 'closed' limit 1`;
  return l ? { basis: parseUsd4(l.cost_basis), qty: Number(l.qty), cycleId: l.cycle_id as string } : null;
}

export async function createMemo(d: Deps, tx: Tx, phase?: "cash-put" | "shares-held") {
  const w = await loadWheelContext(tx);
  const p = phase ?? w.phase;
  if (p !== w.phase) throw problem("PHASE_MISMATCH", `You are in the ${w.phase} phase.`);
  const market = await marketById(tx, null);
  const [rate] = await tx.sql`select rate_id from app.rate_snapshot where kind in ('tbill_13w','tbill_4w') order by as_of desc, created_at desc limit 1`;
  if (!w.account) throw problem("VALIDATION_FAILED", "Capture an account snapshot on Inputs first.", { errors: [{ pointer: "/account", message: "Missing" }] });
  if (!market || market.quotes.length === 0) throw problem("EMPTY_CHAIN", "No quote, refusing to invent one. Capture a chain on Inputs.");
  if (p === "cash-put" && !rate) throw problem("RATE_NOT_CITED", "Cite a T-bill rate with its source on Inputs.");
  const [existing] = await tx.sql`select m.memo_id from app.decision_memo m
                                   where m.status = 'building' and m.deleted_at is null and m.phase = ${p}
                                     and not exists (select 1 from app.draft_preview d where d.memo_id = m.memo_id and d.status in ('open','approved','submitted_by_user'))
                                   order by m.created_at desc limit 1`;
  let memoId: string;
  if (existing) {
    memoId = existing.memo_id;
    await tx.sql`update app.decision_memo set account_snapshot_id = ${w.account.snapshotId}, market_snapshot_id = ${market.market_snapshot_id},
                   rate_id = ${rate?.rate_id ?? null}, envelope_id = ${w.envelopeId}, decision_date = ${exchangeDate(d.clock.now())}, updated_at = now()
                 where memo_id = ${memoId}`;
  } else {
    const [m] = await tx.sql`insert into app.decision_memo (user_id, decision_date, phase, envelope_id, account_snapshot_id, market_snapshot_id, rate_id)
                              values (${tx.userId}, ${exchangeDate(d.clock.now())}, ${p}, ${w.envelopeId}, ${w.account.snapshotId}, ${market.market_snapshot_id}, ${rate?.rate_id ?? null})
                              returning memo_id`;
    memoId = m.memo_id;
    await tx.audit({ action: "memo_created", scr: p === "cash-put" ? "SCR-031" : "SCR-036", payload: { memo: memoId, phase: p } });
  }
  await scoreMemo(d, tx, memoId);
  return getMemo(d, tx, memoId);
}

export async function scoreMemo(d: Deps, tx: Tx, memoId: string) {
  const m = await assertBuilding(tx, memoId);
  const market = await marketById(tx, m.market_snapshot_id);
  if (!market) throw problem("EMPTY_CHAIN");
  const w = await loadWheelContext(tx);
  const rate = await latestRate(tx, m.rate_id);
  const basis = await openBasis(tx);
  const rows = scoreCandidates(
    (market.quotes as { quote_id: string; put_call: "P" | "C"; expiry: string; strike: string; bid: string | null; ask: string | null }[]).map((q) => ({
      quoteId: q.quote_id, putCall: q.put_call, expiry: q.expiry, strike: parseUsd4(q.strike),
      bid: q.bid === null ? null : parseUsd4(q.bid), ask: q.ask === null ? null : parseUsd4(q.ask),
    })),
    { now: d.clock.now(), spot: Number(market.spot), quotesAsOf: new Date(market.as_of), envelopeId: m.envelope_id, rfRate: rate.rate,
      settledCashUsd: w.account?.settled ?? (0 as never), reservedOpenUsd: w.reservedUsd, phase: m.phase, costBasis: basis?.basis ?? null },
  );
  await tx.sql`delete from app.candidate where memo_id = ${memoId}`;
  for (const c of rows) {
    if (!c.bid || (!c.put && !c.call)) continue;
    const inv = c.put
      ? { reserve: c.put.reserve, maxProfit: c.put.maxProfit, breakEven: c.put.breakEven, worst: c.put.worstCase }
      : { reserve: 0, maxProfit: c.call!.maxProfit, breakEven: (basis!.basis - c.bid), worst: c.call!.worstCase };
    await tx.sql`insert into app.candidate (memo_id, quote_id, put_call, strike, expiry, dte, otm_pct, limit_price, reserve_usd, max_profit_usd,
                   break_even, worst_case_usd, premium_yield_ann, score, rank, reject_reasons)
                 values (${memoId}, ${c.quoteId}, ${c.putCall}, ${money(c.strike)}, ${c.expiry}, ${Math.max(0, c.dte)}, ${c.otmPct.toFixed(6)}, ${money(c.limitPrice)},
                   ${money(inv.reserve)}, ${money(inv.maxProfit)}, ${money(inv.breakEven)}, ${money(inv.worst)}, ${c.premiumYieldAnn.toFixed(6)},
                   ${c.score === null ? null : c.score.toFixed(6)}, ${c.rank}, ${textArray(c.rejectReasons)}::text[])`;
  }
  await tx.audit({ action: "candidates_scored", scr: m.phase === "cash-put" ? "SCR-031" : "SCR-036",
    payload: { memo: memoId, ranked: rows.filter((r) => r.rank).length, rejected: rows.filter((r) => !r.rank).length } });
  return rows.length;
}

export async function getMemo(d: Deps, tx: Tx, memoId: string) {
  const m = await memoRow(tx, memoId);
  const candidates = await tx.sql`select candidate_id, quote_id, put_call, strike, expiry::text as expiry, dte, otm_pct, limit_price, reserve_usd, max_profit_usd,
                                         break_even, worst_case_usd, premium_yield_ann, score, rank, reject_reasons
                                    from app.candidate where memo_id = ${memoId} order by rank nulls last, strike desc`;
  const market = await marketById(tx, m.market_snapshot_id);
  const priced = new Set((candidates as { quote_id: string }[]).map((c) => c.quote_id));
  const want = m.phase === "cash-put" ? "P" : "C";
  const unpriced = (market?.quotes ?? []).filter((q: { quote_id: string; put_call: string }) => q.put_call === want && !priced.has(q.quote_id))
    .map((q: { quote_id: string; strike: string; expiry: string; bid: string | null; ask: string | null }) => ({ ...q, reject_reasons: ["NO_BID"] }));
  const stress = await tx.sql`select s.kind, s.result_id, s.attached_at, r.model_version, r.seed, r.params, r.claim_label, r.created_at,
                                     case when s.kind = 'mc'
                                          then jsonb_build_object('cagr_p05', r.summary->'cagr_p05', 'cagr_p50', r.summary->'cagr_p50', 'p_below_start', r.summary->'p_below_start', 'median_max_dd', r.summary->'median_max_dd')
                                          else jsonb_build_object('scenario', r.summary->'scenario'->'title', 'csp', r.summary->'summary'->'csp_one_lot', 'buy_hold', r.summary->'summary'->'buy_hold', 'assigned', r.summary->'assigned', 'weeks_under_water', r.summary->'weeks_under_water')
                                     end as headline
                                from app.memo_stress s join app.stress_result r using (result_id) where s.memo_id = ${memoId}`;
  const [packet] = await tx.sql`select has_crash, has_mc, packet_complete from app.v_memo_packet where memo_id = ${memoId}`;
  const [skip] = await tx.sql`select code, note, created_at from app.memo_skip where memo_id = ${memoId}`;
  const drafts = await tx.sql`select draft_id, status, put_call, strike, expiry::text as expiry, limit_price, qty, block_reasons, created_at
                                from app.draft_preview where memo_id = ${memoId} order by created_at desc`;
  const [acct] = m.account_snapshot_id ? await tx.sql`select snapshot_id, as_of, usd_settled_cash, hkd_cash, options_level, fx_loan_flag from app.account_snapshot where snapshot_id = ${m.account_snapshot_id}` : [];
  const rate = await latestRate(tx, m.rate_id);
  const basis = m.phase === "shares-held" ? await openBasis(tx) : null;
  const env = ENVELOPES[m.envelope_id as keyof typeof ENVELOPES];
  return {
    memo: m, envelope: { id: env.id, label: env.label, otm_min: env.otmMin, otm_max: env.otmMax, dte_min: env.dteMin, dte_max: env.dteMax },
    candidates, unpriced, stress, packet: packet ?? { has_crash: false, has_mc: false, packet_complete: false }, skip: skip ?? null, drafts,
    inputs: { account: acct ?? null, market: market ? { market_snapshot_id: market.market_snapshot_id, spot: market.spot, as_of: market.as_of, ex_dividend_date: market.ex_dividend_date } : null, rate },
    basis: basis ? { basis: money(basis.basis), qty: basis.qty, cycle_id: basis.cycleId } : null,
    frozen: drafts.some((x: { status: string }) => ["open", "approved", "submitted_by_user"].includes(x.status)) || m.status !== "building",
  };
}

export async function listMemos(tx: Tx, opts: { cursor?: string; phase?: string; decision?: string }) {
  const rows = await tx.sql`
    select m.memo_id, m.decision_date::text as decision_date, m.phase, m.status, m.decision, m.precommit_plan, m.rationale, m.envelope_id, m.created_at,
           s.code as skip_code, s.note as skip_note,
           (select json_build_object('draft_id', d.draft_id, 'status', d.status, 'put_call', d.put_call, 'strike', d.strike, 'expiry', d.expiry::text, 'limit_price', d.limit_price)
              from app.draft_preview d where d.memo_id = m.memo_id order by d.created_at desc limit 1) as draft,
           (select json_build_object('strike', c.strike, 'expiry', c.expiry::text, 'put_call', c.put_call, 'limit_price', c.limit_price)
              from app.candidate c where c.memo_id = m.memo_id and c.rank = 1) as top
      from app.decision_memo m left join app.memo_skip s using (memo_id)
     where m.deleted_at is null
       and (${opts.cursor ?? null}::timestamptz is null or m.created_at < ${opts.cursor ?? null}::timestamptz)
       and (${opts.phase ?? null}::text is null or m.phase = ${opts.phase ?? null})
       and (${opts.decision ?? null}::text is null or m.decision::text = ${opts.decision ?? null})
     order by m.created_at desc limit 50`;
  const [q] = await tx.sql`select count(*)::int as memos, count(*) filter (where decision = 'skip')::int as skips from app.decision_memo
                            where deleted_at is null and date_trunc('quarter', decision_date) = date_trunc('quarter', now() at time zone 'America/New_York')`;
  return { items: rows, next_cursor: rows.length === 50 ? rows.at(-1).created_at : null, quarter: q };
}

export async function attachStress(tx: Tx, memoId: string, kind: "crash" | "mc", resultId: string) {
  const m = await assertBuilding(tx, memoId);
  const [r] = await tx.sql`select kind, params from app.stress_result where result_id = ${resultId}`;
  if (!r) throw problem("NOT_FOUND", "Stress result not found");
  if (r.kind !== kind) throw problem("STRESS_MISMATCH", `That result is a ${r.kind} run, not ${kind}.`);
  if (r.params?.envelope_id && r.params.envelope_id !== m.envelope_id) throw problem("STRESS_MISMATCH", `Run it with the ${m.envelope_id} envelope used by this memo.`);
  const [before] = await tx.sql`select packet_complete from app.v_memo_packet where memo_id = ${memoId}`;
  await tx.sql`insert into app.memo_stress (memo_id, kind, result_id) values (${memoId}, ${kind}, ${resultId})
               on conflict (memo_id, kind) do update set result_id = excluded.result_id, attached_at = now()`;
  const [after] = await tx.sql`select has_crash, has_mc, packet_complete from app.v_memo_packet where memo_id = ${memoId}`;
  const scr = m.phase === "cash-put" ? "SCR-032" : "SCR-037";
  await tx.audit({ action: "stress_attached", scr, payload: { memo: memoId, kind, result_id: resultId } });
  if (!before?.packet_complete && after.packet_complete) await tx.audit({ action: "packet_completed", scr, payload: { memo: memoId } });
  return after;
}

export async function detachStress(tx: Tx, memoId: string, kind: string) {
  await assertBuilding(tx, memoId);
  await tx.sql`delete from app.memo_stress where memo_id = ${memoId} and kind = ${kind}`;
  return { ok: true };
}

export async function skipMemo(tx: Tx, memoId: string, code: string, note?: string) {
  const m = await assertBuilding(tx, memoId);
  await tx.sql`insert into app.memo_skip (memo_id, code, note) values (${memoId}, ${code}, ${note ?? null})`;
  await tx.sql`update app.decision_memo set status = 'decided', decision = 'skip', decided_at = now(), updated_at = now() where memo_id = ${memoId}`;
  await tx.audit({ action: "skip_recorded", scr: m.phase === "cash-put" ? "SCR-032" : "SCR-037", payload: { memo: memoId, code, note: note ?? null } });
  return { memo_id: memoId, decision: "skip" };
}

export async function decideMemo(tx: Tx, memoId: string, decision: "sell" | "wait" | "cover_call", plan?: string, rationale?: string) {
  const m = await assertBuilding(tx, memoId);
  if (decision === "sell" && m.phase !== "cash-put") throw problem("PHASE_MISMATCH", "Sell-put decisions belong to the cash-put phase.");
  if (decision === "cover_call" && m.phase !== "shares-held") throw problem("PHASE_MISMATCH", "Covered calls need shares.");
  await tx.sql`update app.decision_memo set status = 'decided', decision = ${decision}, precommit_plan = ${plan ?? null}, rationale = ${rationale ?? null},
                 decided_at = now(), updated_at = now() where memo_id = ${memoId}`;
  await tx.audit({ action: "memo_decided", scr: m.phase === "cash-put" ? "SCR-032" : "SCR-037", payload: { memo: memoId, decision } });
  return { memo_id: memoId, decision };
}
