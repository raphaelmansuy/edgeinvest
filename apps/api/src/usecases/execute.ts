// Execute: drafts (never sent), playbook, human gate, fills, lifecycle, wheel ops (E6/E7; docs/02 §6–8, docs/05 §7).
import { LIVE_PHRASE } from "@edge/contracts";
import { playbookFor } from "@edge/content";
import { HALT_TEXT } from "@edge/copy";
import {
  type CycleState, type DraftContext, type DraftFields, ENVELOPES, type Usd4, type WheelEvent, coveredCallInvariants, daysToExpiry, decisionBasis,
  evaluateDraft, exchangeDate, inBand, otmFraction, parseUsd4, shortPutInvariants, times, toDecimalString, transition,
} from "@edge/domain";
import { textArray } from "../adapters/pg";
import type { Deps, Tx } from "../ports";
import { problem } from "../problem";
import { loadWheelContext, raiseHalt } from "./context";
import { openBasis } from "./decide";
import { computeCapabilities } from "./me";

const s = (v: Usd4) => toDecimalString(v);
const OPEN_STATUSES = ["open", "approved", "submitted_by_user"];

interface DraftInput { side: "SELL" | "BUY"; open_close: "open" | "close"; put_call: "P" | "C"; qty: number; strike: string; expiry: string; limit_price: string; order_type: string; tif: "DAY" | "GTC" }

async function snapshotFor(tx: Tx, memoId: string | null) {
  const [m] = memoId
    ? await tx.sql`select s.market_snapshot_id, s.spot, s.as_of, s.ex_dividend_date::text as ex_div from app.decision_memo m join app.market_snapshot s using (market_snapshot_id) where m.memo_id = ${memoId}`
    : await tx.sql`select market_snapshot_id, spot, as_of, ex_dividend_date::text as ex_div from app.market_snapshot order by as_of desc, created_at desc limit 1`;
  return m ?? null;
}

/** One context builder for prepare, review and the agent's explain tool (DRY): rules see exactly the same facts. */
export async function buildDraftContext(d: Deps, tx: Tx, f: DraftInput, memoId: string | null) {
  const w = await loadWheelContext(tx);
  const snap = await snapshotFor(tx, memoId);
  const [q] = snap
    ? await tx.sql`select quote_id, bid, ask from app.option_quote where market_snapshot_id = ${snap.market_snapshot_id}
                    and put_call = ${f.put_call} and expiry = ${f.expiry} and strike = ${f.strike}`
    : [];
  const [packet] = memoId ? await tx.sql`select has_crash, has_mc from app.v_memo_packet where memo_id = ${memoId}` : [];
  const basis = await openBasis(tx);
  const caps = await computeCapabilities(d, tx);
  const draft: DraftFields = {
    underlying: "QQQ", side: f.side, openClose: f.open_close, putCall: f.put_call, qty: f.qty,
    strike: parseUsd4(f.strike), expiry: f.expiry, limitPrice: parseUsd4(f.limit_price), orderType: f.order_type,
  };
  const ctx: DraftContext = {
    now: d.clock.now(), draft,
    quote: q && snap ? { bid: q.bid === null ? null : parseUsd4(q.bid), ask: q.ask === null ? null : parseUsd4(q.ask), asOf: new Date(snap.as_of) } : null,
    spot: Number(snap?.spot ?? 0), envelopeId: w.envelopeId, phase: w.phase, lotsOpen: w.lotsOpen, lotsMax: w.lotsMax,
    settledCashUsd: w.account?.settled ?? (0 as Usd4), reservedOpenUsd: w.reservedUsd, fxLoan: w.account?.fxLoan ?? false,
    optionsLevel: w.account?.optionsLevel ?? null, accountAsOf: w.account ? new Date(w.account.asOf) : null,
    packet: { hasCrash: Boolean(packet?.has_crash), hasMc: Boolean(packet?.has_mc) },
    costBasis: basis?.basis ?? null, lockedLossAccepted: Boolean(basis && w.lockedLossAcceptedFor === basis.cycleId),
    haltReason: w.haltReason, mode: w.mode, liveEligible: caps.live_eligible, exDividendDate: snap?.ex_div ?? null,
  };
  return { ctx, w, snap, quote: q ?? null, basis };
}

function invariantsOf(putCall: "P" | "C", strike: Usd4, premium: Usd4, qty: number, basis: Usd4 | null) {
  try {
    if (putCall === "P") {
      const i = shortPutInvariants({ strike, premium, qty });
      return { kind: "put" as const, reserve: s(i.reserve), max_profit: s(i.maxProfit), break_even: s(i.breakEven), worst_case: s(i.worstCase) };
    }
    if (basis === null) return null;
    const i = coveredCallInvariants({ strike, premium, qty, costBasis: basis });
    return { kind: "call" as const, shares_covered: i.sharesCovered, credit: s(i.creditOnly), max_profit: s(i.maxProfit), worst_case: s(i.worstCase),
      locked_loss: i.lockedLoss, basis: s(basis), share_break_even: s((basis - premium) as Usd4) };
  } catch { return null; }
}

// ------------------------------------------------------------------ drafts
export async function prepareDraft(d: Deps, tx: Tx, r: DraftInput & { memo_id?: string; candidate_id?: string; cycle_id?: string; precommit_plan?: string }) {
  await tx.sql`select 1 from app.wheel_state where user_id = ${tx.userId} for update`;
  let memo: Record<string, unknown> | null = null;
  if (r.open_close === "open") {
    if (!r.memo_id) throw problem("VALIDATION_FAILED", "Opening drafts come from a decision packet.", { errors: [{ pointer: "/memo_id", message: "Required" }] });
    [memo] = await tx.sql`select * from app.decision_memo where memo_id = ${r.memo_id} and deleted_at is null for update`;
    if (!memo) throw problem("NOT_FOUND", "Memo not found");
    const [active] = await tx.sql`select draft_id from app.draft_preview where memo_id = ${r.memo_id} and status::text = any(${textArray(OPEN_STATUSES)}::text[])`;
    if (active) throw problem("MEMO_FROZEN", "This memo already has a draft. Open it or discard it first.", { draft_id: active.draft_id });
    if (memo.status === "decided" && !["sell", "cover_call"].includes(String(memo.decision))) throw problem("MEMO_FROZEN", `This memo is decided (${memo.decision}).`);
    const plan = r.precommit_plan ?? (memo.precommit_plan as string | null) ?? "";
    if (r.put_call === "P" && plan.trim().length < 10) {
      throw problem("VALIDATION_FAILED", "Write your plan for a sharp drop (10+ characters)", { errors: [{ pointer: "/precommit_plan", message: "Write your plan for a sharp drop (10+ characters)" }] });
    }
  } else if (!r.cycle_id) throw problem("VALIDATION_FAILED", "Closing drafts need the cycle", { errors: [{ pointer: "/cycle_id", message: "Required" }] });

  const { ctx, w, basis } = await buildDraftContext(d, tx, r, r.memo_id ?? null);
  const ev = evaluateDraft(ctx);
  for (const h of ev.haltsToRaise) await raiseHalt(tx, h, { draft_rule: h, strike: r.strike, qty: r.qty, expiry: r.expiry }, "SCR-041");
  const cycleId = r.cycle_id ?? (r.put_call === "C" ? basis?.cycleId ?? null : null);
  const [row] = await tx.sql`
    insert into app.draft_preview (user_id, memo_id, candidate_id, cycle_id, account_mode, side, open_close, put_call, qty, strike, expiry, limit_price, order_type, tif, status, checklist, block_reasons)
    values (${tx.userId}, ${r.memo_id ?? null}, ${r.candidate_id ?? null}, ${cycleId}, ${w.mode}, ${r.side}, ${r.open_close}, ${r.put_call}, ${r.qty}, ${r.strike},
            ${r.expiry}, ${r.limit_price}, 'LMT', ${r.tif}, ${ev.status}, ${{ results: ev.results, warnings: ev.warnings, entered_order_type: r.order_type }}, ${textArray(ev.reasons)}::text[])
    returning draft_id`;
  if (ev.status === "open" && memo && memo.status === "building") {
    await tx.sql`update app.decision_memo set status = 'decided', decision = ${r.put_call === "P" ? "sell" : "cover_call"},
                   precommit_plan = ${r.precommit_plan ?? memo.precommit_plan ?? null}, decided_at = now(), updated_at = now() where memo_id = ${r.memo_id!}`;
    await tx.audit({ action: "memo_decided", scr: r.put_call === "P" ? "SCR-032" : "SCR-037", payload: { memo: r.memo_id!, decision: r.put_call === "P" ? "sell" : "cover_call" } });
  }
  const scr = r.put_call === "P" ? "SCR-032" : "SCR-037";
  await tx.audit({ action: "draft_preview_created", scr, payload: { draft: row.draft_id, status: ev.status, put_call: r.put_call, strike: r.strike, expiry: r.expiry, qty: r.qty, limit: r.limit_price } });
  if (ev.status === "blocked") await tx.audit({ action: "draft_blocked", scr, payload: { draft: row.draft_id, reasons: ev.reasons } });
  return getDraft(d, tx, row.draft_id);
}

export async function getDraft(d: Deps, tx: Tx, id: string) {
  const [x] = await tx.sql`select draft_id, memo_id, candidate_id, cycle_id, account_mode, side, open_close, put_call, qty, strike, expiry::text as expiry,
                                  limit_price, order_type, tif, status, checklist, block_reasons, steps_done, review, created_at, updated_at
                             from app.draft_preview where draft_id = ${id}`;
  if (!x) throw problem("NOT_FOUND", "Draft not found");
  const [memo] = x.memo_id ? await tx.sql`select memo_id, precommit_plan, phase, decision, envelope_id from app.decision_memo where memo_id = ${x.memo_id}` : [];
  const basis = await openBasis(tx);
  const inv = invariantsOf(x.put_call, parseUsd4(x.strike), parseUsd4(x.limit_price), x.qty, x.put_call === "C" ? basis?.basis ?? null : null);
  const snap = await snapshotFor(tx, x.memo_id);
  const [leg] = await tx.sql`select leg_id, cycle_id, open_price, opened_at from app.option_leg where draft_id = ${id}`;
  const steps = playbookFor(x.put_call, x.account_mode).map((st) => ({ id: st.id, group: st.group }));
  return {
    draft: x, memo: memo ?? null, invariants: inv, dte: daysToExpiry(x.expiry, d.clock.now()),
    market: snap ? { spot: snap.spot, as_of: snap.as_of, ex_dividend_date: snap.ex_div } : null,
    steps, steps_complete: steps.every((st) => (x.steps_done as string[]).includes(st.id)),
    fill: leg ?? null,
  };
}

export async function reviewDraft(d: Deps, tx: Tx, id: string) {
  const [x] = await tx.sql`select *, expiry::text as expiry_s from app.draft_preview where draft_id = ${id} for update`;
  if (!x) throw problem("NOT_FOUND");
  if (!["open", "blocked"].includes(x.status)) throw problem("ILLEGAL_TRANSITION", `Draft is ${x.status}.`);
  const f: DraftInput = { side: x.side, open_close: x.open_close, put_call: x.put_call, qty: x.qty, strike: x.strike,
    expiry: x.expiry_s, limit_price: x.limit_price, order_type: x.checklist?.entered_order_type ?? x.order_type, tif: x.tif };
  const { ctx } = await buildDraftContext(d, tx, f, x.memo_id);
  const ev = evaluateDraft(ctx);
  await tx.sql`update app.draft_preview set status = ${ev.status}, block_reasons = ${textArray(ev.reasons)}::text[], checklist = ${{ results: ev.results, warnings: ev.warnings, entered_order_type: f.order_type }},
                 review = ${{ at: d.clock.now().toISOString(), status: ev.status, reasons: ev.reasons, warnings: ev.warnings }}, updated_at = now()
               where draft_id = ${id}`;
  await tx.audit({ action: "draft_reviewed", scr: "SCR-041", payload: { draft: id, status: ev.status, reasons: ev.reasons } });
  return getDraft(d, tx, id);
}

export async function markStep(d: Deps, tx: Tx, id: string, step: string, done: boolean) {
  const [x] = await tx.sql`select draft_id, put_call, account_mode, status, steps_done from app.draft_preview where draft_id = ${id} for update`;
  if (!x) throw problem("NOT_FOUND");
  if (x.status !== "open") throw problem("ILLEGAL_TRANSITION", `Draft is ${x.status}.`);
  if (step === "pre.paper_bar_missing") {
    await raiseHalt(tx, "paper_bar_missing", { draft: id }, x.put_call === "P" ? "SCR-040" : "SCR-043");
    await tx.sql`update app.draft_preview set status = 'blocked', block_reasons = '{HALT_ACTIVE}', updated_at = now() where draft_id = ${id}`;
    await tx.audit({ action: "playbook_step", scr: x.put_call === "P" ? "SCR-040" : "SCR-043", payload: { draft: id, step, done: true } });
    return getDraft(d, tx, id);
  }
  const allowed = playbookFor(x.put_call, x.account_mode).map((st) => st.id);
  if (!allowed.includes(step)) throw problem("VALIDATION_FAILED", `Unknown step ${step}`);
  const set = new Set<string>(x.steps_done);
  if (done) set.add(step); else set.delete(step);
  await tx.sql`update app.draft_preview set steps_done = ${textArray([...set])}::text[], updated_at = now() where draft_id = ${id}`;
  await tx.audit({ action: "playbook_step", scr: x.put_call === "P" ? "SCR-040" : "SCR-043", payload: { draft: id, step, done } });
  return getDraft(d, tx, id);
}

export async function humanGate(d: Deps, tx: Tx, id: string, livePhrase?: string) {
  const [x] = await tx.sql`select draft_id, put_call, account_mode, status, steps_done, strike, qty, limit_price from app.draft_preview where draft_id = ${id} for update`;
  if (!x) throw problem("NOT_FOUND");
  if (x.status !== "open") throw problem("ILLEGAL_TRANSITION", x.status === "blocked" ? "A blocked draft cannot pass the human gate. Fix it on the draft coach." : `Draft is ${x.status}.`);
  const missing = playbookFor(x.put_call, x.account_mode).filter((st) => !(x.steps_done as string[]).includes(st.id));
  if (missing.length) throw problem("CAPABILITY_MISSING", `Finish the playbook first (${missing.length} step${missing.length > 1 ? "s" : ""} left).`, { missing: missing.map((m) => m.id) });
  if (x.account_mode === "live" && livePhrase !== LIVE_PHRASE) {
    throw problem("VALIDATION_FAILED", `Type "${LIVE_PHRASE}" to confirm a live order`, { errors: [{ pointer: "/live_phrase", message: "Typed confirmation required" }] });
  }
  await tx.sql`update app.draft_preview set status = 'submitted_by_user', updated_at = now() where draft_id = ${id}`;
  await tx.audit({ action: "draft_submitted_by_user", scr: "SCR-042", payload: { draft: id, mode: x.account_mode, put_call: x.put_call, strike: x.strike, qty: x.qty, limit: x.limit_price } });
  return getDraft(d, tx, id);
}

export async function discardDraft(tx: Tx, id: string) {
  const [x] = await tx.sql`select status from app.draft_preview where draft_id = ${id} for update`;
  if (!x) throw problem("NOT_FOUND");
  const [leg] = await tx.sql`select 1 from app.option_leg where draft_id = ${id}`;
  if (x.status === "discarded") return { ok: true };
  if (leg) throw problem("ILLEGAL_TRANSITION", "This draft has a recorded fill. Record the outcome on the cycle instead.");
  await tx.sql`update app.draft_preview set status = 'discarded', block_reasons = '{}', deleted_at = now(), updated_at = now() where draft_id = ${id}`;
  await tx.audit({ action: "draft_discarded", scr: "SCR-042", payload: { draft: id, from: x.status } });
  return { ok: true };
}

// ------------------------------------------------------------------ fills & lifecycle
async function ledger(tx: Tx, mode: string, kind: string, amount: Usd4, at: Date, refs: { cycle?: string; leg?: string; lot?: string }) {
  await tx.sql`insert into app.ledger_entry (user_id, mode, cycle_id, leg_id, lot_id, kind, amount_usd, trade_date, source)
               values (${tx.userId}, ${mode}, ${refs.cycle ?? null}, ${refs.leg ?? null}, ${refs.lot ?? null}, ${kind}, ${s(amount)}, ${exchangeDate(at)}, 'manual')`;
}
function assertPast(at: Date, notBefore?: Date) {
  if (at.getTime() > Date.now() + 5 * 60_000) throw problem("VALIDATION_FAILED", "That time is in the future", { errors: [{ pointer: "/at", message: "Not in the future" }] });
  if (notBefore && at.getTime() < new Date(notBefore).getTime()) throw problem("VALIDATION_FAILED", "That time is before the leg was opened", { errors: [{ pointer: "/at", message: "Before the fill" }] });
}

export async function recordFill(d: Deps, tx: Tx, id: string, price: string, filledAt: string) {
  const [x] = await tx.sql`select * , expiry::text as expiry_s from app.draft_preview where draft_id = ${id} for update`;
  if (!x) throw problem("NOT_FOUND");
  if (x.status !== "submitted_by_user") throw problem("ILLEGAL_TRANSITION", "Record a fill only after the human gate.");
  const [dup] = await tx.sql`select 1 from app.option_leg where draft_id = ${id}`;
  if (dup) throw problem("ILLEGAL_TRANSITION", "The fill for this draft is already recorded.");
  const at = new Date(filledAt);
  assertPast(at, new Date(new Date(x.created_at).getTime() - 60_000));
  const p = parseUsd4(price);
  const credit = times(p, 100 * x.qty);
  if (x.open_close === "close") return recordEvent(d, tx, x.cycle_id, { event: "bought_back", at: filledAt, price });
  let cycleId: string;
  if (x.put_call === "P") {
    const [c] = await tx.sql`insert into app.wheel_cycle (user_id, mode, state) values (${tx.userId}, ${x.account_mode}, 'short_put_open') returning cycle_id`;
    cycleId = c.cycle_id;
  } else {
    const [c] = await tx.sql`select cycle_id, state from app.wheel_cycle where cycle_id = ${x.cycle_id} for update`;
    if (!c) throw problem("NOT_FOUND", "Cycle not found");
    const t = transition(c.state, { type: "CALL_FILLED" });
    if (!t.ok) throw problem("ILLEGAL_TRANSITION", `A call can only be sold while holding shares without an open call (state ${c.state}).`);
    await tx.sql`update app.wheel_cycle set state = 'shares_short_call' where cycle_id = ${c.cycle_id}`;
    cycleId = c.cycle_id;
  }
  const [leg] = await tx.sql`insert into app.option_leg (cycle_id, draft_id, put_call, strike, expiry, qty, open_price, opened_at)
                              values (${cycleId}, ${id}, ${x.put_call}, ${x.strike}, ${x.expiry_s}, ${x.qty}, ${price}, ${filledAt}) returning leg_id`;
  await tx.sql`update app.draft_preview set cycle_id = ${cycleId}, updated_at = now() where draft_id = ${id}`;
  await ledger(tx, x.account_mode, x.put_call === "P" ? "put_premium" : "call_premium", credit, at, { cycle: cycleId, leg: leg.leg_id });
  await tx.audit({ action: "fill_recorded", scr: "SCR-103", payload: { draft: id, cycle: cycleId, price, limit: x.limit_price, filled_at: filledAt } });
  return getCycle(d, tx, cycleId);
}

type LifecycleReq =
  | { event: "expired"; at: string } | { event: "bought_back"; at: string; price: string } | { event: "assigned"; at: string }
  | { event: "called_away"; at: string } | { event: "shares_sold"; at: string; price: string }
  | { event: "rolled"; at: string; close_price: string; open_strike: string; open_expiry: string; open_price: string };

const WHY_ILLEGAL: Record<string, string> = {
  assigned: "Assignment applies to an open short put.",
  called_away: "Called away applies to an open covered call.",
  shares_sold: "Close the open call first, then sell the shares.",
  expired: "There is no open option leg to expire.",
  bought_back: "There is no open option leg to buy back.",
  rolled: "There is no open option leg to roll.",
};

export async function recordEvent(d: Deps, tx: Tx, cycleId: string, r: LifecycleReq) {
  const [c] = await tx.sql`select cycle_id, state, mode from app.wheel_cycle where cycle_id = ${cycleId} for update`;
  if (!c) throw problem("NOT_FOUND", "Cycle not found");
  const [leg] = await tx.sql`select leg_id, put_call, strike, qty, open_price, opened_at, expiry::text as expiry from app.option_leg where cycle_id = ${cycleId} and closed_at is null`;
  const [lot] = await tx.sql`select lot_id, qty, cost_basis from app.share_lot where cycle_id = ${cycleId} and closed_at is null`;
  const pc = leg?.put_call as "P" | "C" | undefined;
  const evType: WheelEvent["type"] | null = ({
    expired: pc === "P" ? "PUT_EXPIRED" : pc === "C" ? "CALL_EXPIRED" : null,
    bought_back: pc === "P" ? "PUT_BOUGHT_BACK" : pc === "C" ? "CALL_BOUGHT_BACK" : null,
    rolled: pc === "P" ? "PUT_ROLLED" : pc === "C" ? "CALL_ROLLED" : null,
    assigned: pc === "P" ? "PUT_ASSIGNED" : null,
    called_away: pc === "C" ? "CALLED_AWAY" : null,
    shares_sold: !leg && lot ? "SHARES_SOLD" : null,
  } as const)[r.event];
  const t = evType ? transition(c.state as CycleState, { type: evType } as WheelEvent) : null;
  if (!t || !t.ok) throw problem("ILLEGAL_TRANSITION", `${WHY_ILLEGAL[r.event]} This cycle is ${String(c.state).replaceAll("_", " ")}.`);
  const at = new Date(r.at);
  assertPast(at, leg?.opened_at);
  const mode = c.mode as string;
  const qty = Number(leg?.qty ?? (lot ? lot.qty / 100 : 1));
  const closeLeg = (price: string, reason: string) =>
    tx.sql`update app.option_leg set close_price = ${price}, closed_at = ${r.at}, close_reason = ${reason} where leg_id = ${leg!.leg_id}`;
  const setState = (to: CycleState) =>
    to === "closed"
      ? tx.sql`update app.wheel_cycle set state = 'closed', closed_at = ${r.at} where cycle_id = ${cycleId}`
      : tx.sql`update app.wheel_cycle set state = ${to} where cycle_id = ${cycleId}`;
  let phaseChanged = false;

  switch (r.event) {
    case "expired":
      await closeLeg("0", "expired");
      await setState(t.to);
      break;
    case "bought_back": {
      await closeLeg(r.price, "bought_back");
      await ledger(tx, mode, "buy_to_close", times(parseUsd4(r.price), -100 * qty), at, { cycle: cycleId, leg: leg!.leg_id });
      await setState(t.to);
      break;
    }
    case "rolled": {
      const w = await loadWheelContext(tx);
      const env = ENVELOPES[w.envelopeId];
      const [m] = await tx.sql`select spot from app.market_snapshot order by as_of desc limit 1`;
      const spot = Number(m?.spot ?? 0);
      const dte = daysToExpiry(r.open_expiry, at);
      const errors: { pointer: string; message: string }[] = [];
      if (r.open_expiry <= leg!.expiry) errors.push({ pointer: "/open_expiry", message: "A roll opens a later expiry" });
      if (pc === "P") {
        if (spot && !inBand(otmFraction("P", spot, Number(r.open_strike)), env.otmMin, env.otmMax)) errors.push({ pointer: "/open_strike", message: `Outside ${env.label} OTM band` });
        if (dte < env.dteMin || dte > env.dteMax) errors.push({ pointer: "/open_expiry", message: `DTE ${dte} outside ${env.dteMin}–${env.dteMax}` });
        const oldReserve = times(parseUsd4(leg!.strike), 100 * qty);
        const newReserve = times(parseUsd4(r.open_strike), 100 * qty);
        if (w.account && w.account.settled - (w.reservedUsd - oldReserve) < newReserve) errors.push({ pointer: "/open_strike", message: "Not fully cash-secured at the new strike" });
      } else if (lot && parseUsd4(r.open_strike) < parseUsd4(lot.cost_basis) && w.lockedLossAcceptedFor !== cycleId) {
        errors.push({ pointer: "/open_strike", message: "Below your decision basis: accept the locked loss first" });
      }
      if (errors.length) throw problem("VALIDATION_FAILED", errors[0]!.message, { errors });
      await closeLeg(r.close_price, "rolled");
      await ledger(tx, mode, "buy_to_close", times(parseUsd4(r.close_price), -100 * qty), at, { cycle: cycleId, leg: leg!.leg_id });
      const [nl] = await tx.sql`insert into app.option_leg (cycle_id, put_call, strike, expiry, qty, open_price, opened_at)
                                 values (${cycleId}, ${pc}, ${r.open_strike}, ${r.open_expiry}, ${qty}, ${r.open_price}, ${r.at}) returning leg_id`;
      await ledger(tx, mode, pc === "P" ? "put_premium" : "call_premium", times(parseUsd4(r.open_price), 100 * qty), at, { cycle: cycleId, leg: nl.leg_id });
      break;
    }
    case "assigned": {
      const credits = await tx.sql`select e.amount_usd from app.ledger_entry e join app.option_leg l using (leg_id)
                                    where e.cycle_id = ${cycleId} and e.kind = 'put_premium' and l.put_call = 'P'`;
      const debits = await tx.sql`select e.amount_usd from app.ledger_entry e join app.option_leg l using (leg_id)
                                   where e.cycle_id = ${cycleId} and e.kind = 'buy_to_close' and l.put_call = 'P'`;
      const basis = decisionBasis(parseUsd4(leg!.strike), credits.map((x: { amount_usd: string }) => parseUsd4(x.amount_usd)),
        debits.map((x: { amount_usd: string }) => parseUsd4(x.amount_usd)), qty);
      await closeLeg("0", "assigned");
      await setState("shares_held");
      const [nl] = await tx.sql`insert into app.share_lot (cycle_id, qty, cost_basis, assigned_from_leg_id, opened_at)
                                 values (${cycleId}, ${100 * qty}, ${s(basis)}, ${leg!.leg_id}, ${r.at}) returning lot_id`;
      await ledger(tx, mode, "assignment_purchase", times(parseUsd4(leg!.strike), -100 * qty), at, { cycle: cycleId, leg: leg!.leg_id, lot: nl.lot_id });
      await tx.sql`update app.wheel_state set willingness_confirmed_at = null, version = version + 1, updated_at = now() where user_id = ${tx.userId}`;
      await tx.audit({ action: "assignment_confirmed", scr: "SCR-034", payload: { cycle: cycleId, strike: leg!.strike, basis: s(basis), shares: 100 * qty } });
      phaseChanged = true;
      break;
    }
    case "called_away": {
      await closeLeg("0", "called_away");
      await tx.sql`update app.share_lot set closed_at = ${r.at}, close_reason = 'called_away' where lot_id = ${lot!.lot_id}`;
      await ledger(tx, mode, "called_away_sale", times(parseUsd4(leg!.strike), 100 * qty), at, { cycle: cycleId, leg: leg!.leg_id, lot: lot!.lot_id });
      await setState("closed");
      phaseChanged = true;
      break;
    }
    case "shares_sold": {
      await tx.sql`update app.share_lot set closed_at = ${r.at}, close_reason = 'sold_manual' where lot_id = ${lot!.lot_id}`;
      await ledger(tx, mode, "share_sale", times(parseUsd4(r.price), Number(lot!.qty)), at, { cycle: cycleId, lot: lot!.lot_id });
      await setState("closed");
      phaseChanged = true;
      break;
    }
  }
  if (t.to === "closed") {
    await tx.sql`update app.wheel_state set locked_loss_accepted_for = null, version = version + 1, updated_at = now()
                 where user_id = ${tx.userId} and locked_loss_accepted_for = ${cycleId}`;
  }
  await tx.audit({ action: "lifecycle_event", scr: pc === "C" ? "SCR-044" : "SCR-103", payload: { cycle: cycleId, event: r.event, from: c.state, to: t.to } });
  if (phaseChanged) await tx.audit({ action: "phase_changed", scr: "SCR-034", payload: { cycle: cycleId, to: t.to === "shares_held" ? "shares-held" : "cash-put" } });
  return getCycle(d, tx, cycleId);
}

export async function getCycle(d: Deps, tx: Tx, id: string) {
  const [c] = await tx.sql`select cycle_id, mode, state, phase, opened_at, closed_at from app.wheel_cycle where cycle_id = ${id}`;
  if (!c) throw problem("NOT_FOUND", "Cycle not found");
  const legs = await tx.sql`select leg_id, draft_id, put_call, strike, expiry::text as expiry, qty, open_price, opened_at, close_price, closed_at, close_reason
                              from app.option_leg where cycle_id = ${id} order by opened_at`;
  const [lot] = await tx.sql`select lot_id, qty, cost_basis, opened_at, closed_at, close_reason from app.share_lot where cycle_id = ${id}`;
  const entries = await tx.sql`select entry_id, kind, amount_usd, trade_date::text as trade_date, quarter_label from app.ledger_entry where cycle_id = ${id} order by trade_date, created_at`;
  const [plan] = await tx.sql`select m.precommit_plan, d.draft_id, d.limit_price from app.draft_preview d left join app.decision_memo m using (memo_id)
                                where d.cycle_id = ${id} order by d.created_at limit 1`;
  const drafts = await tx.sql`select draft_id, put_call, open_close, status, strike, expiry::text as expiry, limit_price, created_at from app.draft_preview
                                where cycle_id = ${id} order by created_at desc`;
  const [m] = await tx.sql`select spot, as_of from app.market_snapshot order by as_of desc limit 1`;
  const open = (legs as { closed_at: Date | null }[]).find((l) => !l.closed_at) ?? null;
  return { cycle: c, legs, open_leg: open, lot: lot ?? null, ledger: entries, plan: plan?.precommit_plan ?? null, first_draft: plan ?? null, drafts,
    spot: m ? { spot: m.spot, as_of: m.as_of } : null, now: d.clock.now().toISOString() };
}

// ------------------------------------------------------------------ wheel ops
export async function wheelState(tx: Tx) {
  const w = await loadWheelContext(tx);
  const [halt] = w.haltReason
    ? await tx.sql`select payload, ts from app.audit_event where action = 'halt_raised' order by seq desc limit 1`
    : [];
  const vetoes = await tx.sql`select draft_id, put_call, strike, expiry::text as expiry, block_reasons, created_at from app.draft_preview
                               where status = 'blocked' and 'LOCKED_LOSS_UNSIGNED' = any(block_reasons) order by created_at desc limit 5`;
  const basis = await openBasis(tx);
  const cycles = await tx.sql`select c.cycle_id, c.state, c.mode, c.opened_at,
                                     (select json_build_object('put_call', l.put_call, 'strike', l.strike, 'expiry', l.expiry::text, 'open_price', l.open_price)
                                        from app.option_leg l where l.cycle_id = c.cycle_id and l.closed_at is null) as open_leg
                                from app.wheel_cycle c where c.state <> 'closed' order by c.opened_at`;
  return {
    mode: w.mode, phase: w.phase, lots_open: w.lotsOpen, lots_max: w.lotsMax, reserved_usd: s(w.reservedUsd), version: w.version,
    halt: w.haltReason ? { reason: w.haltReason, at: w.haltedAt, evidence: halt?.payload?.evidence ?? null, ...HALT_TEXT[w.haltReason] } : null,
    willingness_confirmed_at: w.willingnessConfirmedAt, locked_loss_accepted_for: w.lockedLossAcceptedFor,
    basis: basis ? { basis: s(basis.basis), qty: basis.qty, cycle_id: basis.cycleId } : null,
    cycles, vetoes,
    account: w.account ? { as_of: w.account.asOf, settled: s(w.account.settled), hkd: s(w.account.hkd), fx_loan: w.account.fxLoan, options_level: w.account.optionsLevel } : null,
  };
}

export async function recordWillingness(tx: Tx, willing: boolean, statement?: string) {
  const w = await loadWheelContext(tx, { forUpdate: true });
  if (w.phase !== "shares-held") throw problem("PHASE_MISMATCH", "Willingness is asked while you hold shares.");
  if (willing) {
    await tx.sql`update app.wheel_state set willingness_confirmed_at = now(), version = version + 1, updated_at = now() where user_id = ${tx.userId}`;
  } else {
    await tx.sql`update app.wheel_state set willingness_confirmed_at = null, version = version + 1, updated_at = now() where user_id = ${tx.userId}`;
    await raiseHalt(tx, "willingness_declined", { statement: statement ?? null }, "SCR-035");
  }
  await tx.audit({ action: "willingness_recorded", scr: "SCR-035", payload: { willing, statement: statement ?? null } });
  return wheelState(tx);
}

/** A halt clears only when its condition is false again (docs/04 §4.4). */
export async function clearHalt(tx: Tx) {
  const w = await loadWheelContext(tx, { forUpdate: true });
  if (!w.haltReason) return wheelState(tx);
  const persists: Record<string, () => string | null> = {
    fx_loan: () => (!w.account ? "Capture a new account snapshot first." : w.account.fxLoan ? "The latest snapshot still shows a negative balance." : null),
    level_gap: () => ((w.account?.optionsLevel ?? 0) < 3 && w.phase === "cash-put" ? "The latest snapshot still shows options Level < 3." : null),
    second_lot_without_cash: () => null,
    willingness_declined: () => (w.phase === "shares-held" && !w.willingnessConfirmedAt ? "Re-affirm willingness on the Willingness screen first." : null),
    locked_loss_unsigned: () => null,
    packet_incomplete: () => null,
    empty_chain: () => null,
    paper_bar_missing: () => null,
  };
  const why = persists[w.haltReason]?.() ?? null;
  if (why) throw problem("HALT_CONDITION_PERSISTS", why);
  await tx.sql`update app.wheel_state set halt_reason = null, halted_at = null, version = version + 1, updated_at = now() where user_id = ${tx.userId}`;
  await tx.audit({ action: "halt_cleared", scr: "SCR-045", payload: { reason: w.haltReason } });
  return wheelState(tx);
}

export async function acceptLockedLoss(tx: Tx, cycleId: string) {
  const [c] = await tx.sql`select state from app.wheel_cycle where cycle_id = ${cycleId}`;
  if (!c) throw problem("NOT_FOUND");
  if (c.state !== "shares_held" && c.state !== "shares_short_call") throw problem("PHASE_MISMATCH", "A locked loss applies while you hold shares.");
  await tx.sql`update app.wheel_state set locked_loss_accepted_for = ${cycleId}, version = version + 1, updated_at = now() where user_id = ${tx.userId}`;
  await tx.audit({ action: "locked_loss_accepted", scr: "SCR-045", payload: { cycle: cycleId } });
  const [ws] = await tx.sql`select halt_reason from app.wheel_state where user_id = ${tx.userId}`;
  if (ws?.halt_reason === "locked_loss_unsigned") {
    await tx.sql`update app.wheel_state set halt_reason = null, halted_at = null where user_id = ${tx.userId}`;
    await tx.audit({ action: "halt_cleared", scr: "SCR-045", payload: { reason: "locked_loss_unsigned" } });
  }
  return wheelState(tx);
}
