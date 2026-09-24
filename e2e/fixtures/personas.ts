// E2E personas (docs/14 §3). Each is built through the REAL use cases inside `SET LOCAL ROLE edge_app` + RLS user,
// so seeding is itself an integration test of the wheel: a broken rule or trigger fails the seed, not a screenshot.
import { fakeLlm } from "@edge/api/adapters/fake-llm";
import { makeTx } from "@edge/api/adapters/pg";
import { inlineSimRunner } from "@edge/api/adapters/sim";
import type { Deps, Tx } from "@edge/api/ports";
import * as decide from "@edge/api/usecases/decide";
import * as ex from "@edge/api/usecases/execute";
import * as learn from "@edge/api/usecases/learn";
import * as me from "@edge/api/usecases/me";
import * as sim from "@edge/api/usecases/sim";
import { gradeQuiz, quizItems, SEVEN_WORDS } from "@edge/content";
import { COPY_VERSION, DISCLOSURES } from "@edge/copy";
import { COMPETENCIES, daysToExpiry, exchangeDate, MASTERY_RULES } from "@edge/domain";
import type { SQL } from "bun";
import { ensureUser } from "../../tools/seed";
import { DEV_PASSWORD, DEV_PERSONAS } from "./dev-accounts";

export const PASSWORD = DEV_PASSWORD;
export const PERSONAS = Object.fromEntries(DEV_PERSONAS.map((p) => [p.id, p.email])) as {
  [P in (typeof DEV_PERSONAS)[number] as P["id"]]: P["email"];
};
export type Persona = keyof typeof PERSONAS;

function seedDeps(sql: SQL): Deps {
  return {
    sql,
    uow: {
      run: (userId, fn) =>
        sql.begin(async (t) => {
          await t`set local role edge_app`;
          await t`select set_config('app.user_id', ${userId}, true)`;
          return fn(makeTx(t as unknown as SQL, userId));
        }) as never,
    },
    clock: { now: () => new Date() },
    llm: fakeLlm("qwen3.5:9b-mlx", "embeddinggemma", true),
    sim: inlineSimRunner(),
    config: { allowedOrigins: [], secureCookies: false, agentModel: "qwen3.5:9b-mlx", promptVersion: "agent-v1" },
  };
}

// ---------------------------------------------------------------- market helpers
function thirdFriday(y: number, m: number) {
  const first = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const day = 1 + ((5 - first + 7) % 7) + 14;
  return new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10);
}
/** Two standard monthly expiries inside the 60–120 DTE envelope, computed from today (ET). */
export function envelopeExpiries(now = new Date()) {
  const out: string[] = [];
  const t = exchangeDate(now);
  for (let k = 1; k < 7 && out.length < 2; k++) {
    const d = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1 + k, 1));
    const e = thirdFriday(d.getUTCFullYear(), d.getUTCMonth());
    const dte = daysToExpiry(e, now);
    if (dte >= 66 && dte <= 114) out.push(e);
  }
  return out as [string, string];
}

export const SPOT = "721.11";
export function putChain(now = new Date()) {
  const [e1, e2] = envelopeExpiries(now);
  const row = (expiry: string, strike: number, bid: number, ask: number) => ({
    put_call: "P" as const,
    expiry,
    strike: String(strike),
    bid: bid.toFixed(2),
    ask: ask.toFixed(2),
    non_standard: false,
  });
  return [
    row(e1, 690, 19.5, 19.8),
    row(e1, 660, 14.2, 14.45),
    row(e1, 650, 12.4, 12.6),
    row(e1, 640, 10.9, 11.1),
    row(e1, 600, 5.1, 5.3),
    row(e2, 650, 15.1, 15.35),
    row(e2, 640, 13.4, 13.65),
    { put_call: "P" as const, expiry: e2, strike: "630", bid: null, ask: "12.20", non_standard: false },
  ];
}
export function callChain(now = new Date()) {
  const [e1] = envelopeExpiries(now);
  const row = (strike: number, bid: number, ask: number) => ({
    put_call: "C" as const,
    expiry: e1,
    strike: String(strike),
    bid: bid.toFixed(2),
    ask: ask.toFixed(2),
    non_standard: false,
  });
  return [row(620, 16.0, 16.4), row(640, 9.1, 9.4), row(660, 5.2, 5.4), row(680, 2.85, 3.0)];
}

export async function captureInputs(
  tx: Tx,
  opts: { settled?: string; hkd?: string; level?: number; spot?: string; calls?: boolean; mode?: "paper" | "live" } = {},
) {
  const now = new Date(Date.now() - 60_000).toISOString();
  await decide.captureAccount(tx, {
    mode: opts.mode ?? "paper",
    as_of: now,
    usd_settled_cash: opts.settled ?? "100000",
    hkd_cash: opts.hkd ?? "0",
    nlv_usd: opts.settled ?? "100000",
    options_level: opts.level ?? 3,
  });
  await decide.captureMarket(tx, {
    spot: opts.spot ?? SPOT,
    as_of: now,
    source: "fixture",
    ex_dividend_date: null,
    quotes: opts.calls ? callChain() : putChain(),
  });
  await decide.captureRate(tx, {
    kind: "tbill_13w",
    rate: "0.0378",
    as_of: "2026-08-27",
    source_url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_bill_rates",
  });
}

async function onboard(d: Deps, tx: Tx, name: string) {
  await me.patchMe(tx, { display_name: name, jurisdiction: "HK", paper_start_cash: "100000" });
  for (const k of DISCLOSURES.filter((x) => x.requiredFor === "onboarded" || x.requiredFor === "execute" || x.requiredFor === "agent")) {
    await me.ackDisclosure(tx, k.key, COPY_VERSION, "SCR-101");
  }
  void d;
}

async function completePacket(d: Deps, tx: Tx) {
  const memo = await decide.createMemo(d, tx, "cash-put");
  const id = memo.memo.memo_id as string;
  const crash = await sim.runCrash(d, tx, {
    scenario_id: "gfc_2008",
    envelope_id: "beginner_v1",
    max_contracts: 1,
    fill_cash: false,
    wheel: true,
    reserve_earns_rf: true,
    scale_to_spot: true,
  });
  const mc = await sim.runMc(d, tx, {
    envelope_id: "beginner_v1",
    paths: 2000,
    quarters: 20,
    seed: 20260828,
    max_contracts: 1,
    sizing_mode: "willingness",
    fill_cash: false,
    reserve_earns_rf: true,
    wheel: false,
  });
  await decide.attachStress(tx, id, "crash", crash.result_id);
  await decide.attachStress(tx, id, "mc", mc.result_id);
  return decide.getMemo(d, tx, id);
}

const PLAN = "If QQQ falls 20 % in week two I hold, accept assignment and sell calls at or above basis. No second lot.";

async function openPutDraft(d: Deps, tx: Tx) {
  const m = await completePacket(d, tx);
  const top = (m.candidates as { candidate_id: string; strike: string; expiry: string; limit_price: string; rank: number | null }[]).find(
    (c) => c.rank === 1,
  )!;
  return ex.prepareDraft(d, tx, {
    memo_id: m.memo.memo_id,
    candidate_id: top.candidate_id,
    side: "SELL",
    open_close: "open",
    put_call: "P",
    qty: 1,
    strike: top.strike,
    expiry: top.expiry,
    limit_price: top.limit_price,
    order_type: "LMT",
    tif: "DAY",
    precommit_plan: PLAN,
  });
}

async function walkPlaybook(d: Deps, tx: Tx, draftId: string) {
  const g = await ex.getDraft(d, tx, draftId);
  for (const st of g.steps) await ex.markStep(d, tx, draftId, st.id, true);
  await ex.humanGate(d, tx, draftId);
}

async function fillPut(d: Deps, tx: Tx) {
  const dr = await openPutDraft(d, tx);
  const id = dr.draft.draft_id as string;
  if (dr.draft.status !== "open") throw new Error(`fixture put draft blocked: ${dr.draft.block_reasons}`);
  await walkPlaybook(d, tx, id);
  const fill = (Number(dr.draft.limit_price) - 0.05).toFixed(2);
  return ex.recordFill(d, tx, id, fill, new Date().toISOString());
}

async function assign(d: Deps, tx: Tx) {
  const c = await fillPut(d, tx);
  return ex.recordEvent(d, tx, c.cycle.cycle_id, { event: "assigned", at: new Date().toISOString() });
}

async function callMemo(d: Deps, tx: Tx) {
  await captureInputs(tx, { spot: "612.40", calls: true, settled: "35000" });
  return decide.createMemo(d, tx, "shares-held");
}

async function learningHistory(d: Deps, tx: Tx, full: boolean) {
  await learn.submitVocab(tx, 1, Object.fromEntries(SEVEN_WORDS.map((c) => [c.word, c.answer])));
  const seed = 4242;
  const items = quizItems("M1", seed);
  const correct = Object.fromEntries(items.map((i) => [i.id, String(i.answer)]));
  await learn.submitQuiz(tx, "M1", seed, correct);
  if (!full) {
    const m3 = quizItems("M3", 77);
    const wrong = Object.fromEntries(m3.map((i, k) => [i.id, k % 2 ? String(i.answer) : "1"]));
    const g = gradeQuiz("M3", 77, wrong);
    if (!g.passed) await learn.submitQuiz(tx, "M3", 77, wrong);
    const t = await learn.startGame(tx, "tutorial", "steady-2024");
    await learn.stepGame(tx, t.attempt_id, { completed: "yes" });
  }
  void d;
}

async function grantMastery(tx: Tx) {
  for (const c of COMPETENCIES)
    for (const r of MASTERY_RULES[c]) {
      await tx.sql`insert into app.competency_evidence (user_id, competency, rule_id, source_ref, passed) values (${tx.userId}, ${c}, ${r.rule}, 'fixture:master', true)`;
    }
  await tx.sql`update app.mastery_progress set paper_wheel_completed_at = now() - interval '20 days' where user_id = ${tx.userId}`;
  const { rebuildMastery } = await import("@edge/api/usecases/mastery");
  await rebuildMastery(tx);
}

/** Closed historical cycles for the ledger / HK journal (dated in the past; written as owner-free SQL through RLS). */
async function ledgerHistory(tx: Tx) {
  const hist = [
    { open: "2025-10-03", put: 560, pp: 9.85, exp: "2025-12-19", outcome: "expired" },
    {
      open: "2026-01-05",
      put: 590,
      pp: 11.2,
      exp: "2026-03-20",
      outcome: "assigned",
      call: 600,
      cp: 8.4,
      cexp: "2026-06-18",
      called: true,
    },
    { open: "2026-06-22", put: 640, pp: 12.35, exp: "2026-09-18", outcome: "expired" },
  ];
  for (const h of hist) {
    const [c] =
      await tx.sql`insert into app.wheel_cycle (user_id, mode, state, opened_at, closed_at) values (${tx.userId}, 'paper', 'closed', ${h.open}, ${h.called ? h.cexp : h.exp}) returning cycle_id`;
    const [leg] =
      await tx.sql`insert into app.option_leg (cycle_id, put_call, strike, expiry, qty, open_price, opened_at, close_price, closed_at, close_reason)
                                values (${c.cycle_id}, 'P', ${h.put}, ${h.exp}, 1, ${h.pp}, ${h.open}, 0, ${h.exp}, ${h.outcome}) returning leg_id`;
    const L = (kind: string, amt: number, date: string, extra: { leg?: string; lot?: string } = {}) =>
      tx.sql`insert into app.ledger_entry (user_id, mode, cycle_id, leg_id, lot_id, kind, amount_usd, trade_date, source)
             values (${tx.userId}, 'paper', ${c.cycle_id}, ${extra.leg ?? null}, ${extra.lot ?? null}, ${kind}, ${amt.toFixed(2)}, ${date}, 'manual')`;
    await L("put_premium", h.pp * 100, h.open, { leg: leg.leg_id });
    if (h.outcome === "assigned") {
      const basis = h.put - h.pp;
      const [lot] =
        await tx.sql`insert into app.share_lot (cycle_id, qty, cost_basis, assigned_from_leg_id, opened_at, closed_at, close_reason)
                                  values (${c.cycle_id}, 100, ${basis}, ${leg.leg_id}, ${h.exp}, ${h.cexp}, 'called_away') returning lot_id`;
      await L("assignment_purchase", -h.put * 100, h.exp, { leg: leg.leg_id, lot: lot.lot_id });
      const [cl] =
        await tx.sql`insert into app.option_leg (cycle_id, put_call, strike, expiry, qty, open_price, opened_at, close_price, closed_at, close_reason)
                                 values (${c.cycle_id}, 'C', ${h.call}, ${h.cexp}, 1, ${h.cp}, '2026-03-23', 0, ${h.cexp}, 'called_away') returning leg_id`;
      await L("call_premium", h.cp! * 100, "2026-03-23", { leg: cl.leg_id });
      await L("called_away_sale", h.call! * 100, h.cexp!, { leg: cl.leg_id, lot: lot.lot_id });
    }
  }
  await tx.sql`insert into app.ledger_entry (user_id, mode, kind, amount_usd, trade_date, source) values (${tx.userId}, 'paper', 'interest', 312.44, '2026-07-01', 'manual')`;
  await tx.sql`insert into app.ledger_entry (user_id, mode, kind, amount_usd, trade_date, source) values (${tx.userId}, 'paper', 'fee', -2.60, '2026-06-22', 'manual')`;
}

const BUILDERS: Record<Persona, (d: Deps, tx: Tx) => Promise<unknown>> = {
  newbie: async () => undefined,
  learner: async (d, tx) => {
    await onboard(d, tx, "Lee");
    await learningHistory(d, tx, false);
  },
  putter: async (d, tx) => {
    await onboard(d, tx, "Pat");
    await learningHistory(d, tx, true);
    await captureInputs(tx);
    await completePacket(d, tx);
  },
  drafter: async (d, tx) => {
    await onboard(d, tx, "Dana");
    await captureInputs(tx);
    await openPutDraft(d, tx);
  },
  shortput: async (d, tx) => {
    await onboard(d, tx, "Sam");
    await captureInputs(tx);
    await fillPut(d, tx);
  },
  holder: async (d, tx) => {
    await onboard(d, tx, "Hana");
    await captureInputs(tx);
    await assign(d, tx);
    await ex.recordWillingness(tx, true, "I can hold 100 QQQ through a further drawdown.");
    await callMemo(d, tx);
  },
  caller: async (d, tx) => {
    await onboard(d, tx, "Cai");
    await captureInputs(tx);
    await assign(d, tx);
    await ex.recordWillingness(tx, true);
    const m = await callMemo(d, tx);
    const top = (m.candidates as { candidate_id: string; strike: string; expiry: string; limit_price: string; rank: number | null }[]).find(
      (c) => c.rank === 1,
    )!;
    const dr = await ex.prepareDraft(d, tx, {
      memo_id: m.memo.memo_id,
      candidate_id: top.candidate_id,
      side: "SELL",
      open_close: "open",
      put_call: "C",
      qty: 1,
      strike: top.strike,
      expiry: top.expiry,
      limit_price: top.limit_price,
      order_type: "LMT",
      tif: "DAY",
    });
    if (dr.draft.status !== "open") throw new Error(`fixture call draft blocked: ${dr.draft.block_reasons}`);
  },
  halted: async (d, tx) => {
    await onboard(d, tx, "Hal");
    await captureInputs(tx);
    await assign(d, tx);
    await ex.recordWillingness(tx, true);
    const m = await callMemo(d, tx);
    const low = (m.candidates as { candidate_id: string; strike: string; expiry: string; limit_price: string }[]).find(
      (c) => Number(c.strike) === 620,
    )!;
    await ex.prepareDraft(d, tx, {
      memo_id: m.memo.memo_id,
      candidate_id: low.candidate_id,
      side: "SELL",
      open_close: "open",
      put_call: "C",
      qty: 1,
      strike: low.strike,
      expiry: low.expiry,
      limit_price: low.limit_price,
      order_type: "LMT",
      tif: "DAY",
    });
    await decide.captureAccount(tx, {
      mode: "paper",
      as_of: new Date(Date.now() - 30_000).toISOString(),
      usd_settled_cash: "-1250",
      hkd_cash: "0",
      nlv_usd: "35000",
      options_level: 3,
    });
  },
  master: async (d, tx) => {
    await onboard(d, tx, "Max");
    await learningHistory(d, tx, true);
    await grantMastery(tx);
    await ledgerHistory(tx);
    await captureInputs(tx);
    await decide
      .createMemo(d, tx, "cash-put")
      .then((m) => decide.skipMemo(tx, m.memo.memo_id, "premium_below_tbill", "Hurdle not met this month"));
  },
};

export async function seedPersonas(sql: SQL, only?: Persona[]) {
  const d = seedDeps(sql);
  for (const [p, email] of Object.entries(PERSONAS) as [Persona, string][]) {
    if (only && !only.includes(p)) continue;
    const userId = await ensureUser(sql, email, PASSWORD, null);
    const [done] = await sql`select 1 from app.audit_event where user_id = ${userId} limit 1`;
    if (done && p !== "newbie") {
      console.log(`persona ${p} exists`);
      continue;
    }
    try {
      await d.uow.run(userId, (tx) => BUILDERS[p](d, tx));
      console.log(`seeded persona ${p} <${email}>`);
    } catch (e) {
      console.error(`persona ${p} failed:`, e);
      throw e;
    }
  }
}
