import type { ScrId } from "@edge/contracts";
import { BasisLockBanner, Button, Card, CardBody, ClaimLabel, DecisionBar, Field, Select, TextInput, TicketThreeNumbers, YieldStack } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { DECIDE_NAV, Err, Screen, StatusBadge } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { AFTER_WHEEL, memoQuery } from "../../lib/queries";
import type { Candidate, DraftView } from "../../lib/shapes";

const SKIP = [
  ["premium_below_tbill", "Premium below the T-bill"],
  ["otm_outside_envelope", "Outside the envelope"],
  ["fx_imbalance", "FX imbalance"],
  ["concentration", "Concentration"],
  ["crash_uncomfortable", "Crash replay is uncomfortable"],
  ["no_level3", "No Level 3"],
  ["personal_discretion", "Personal discretion"],
  ["other", "Other"],
] as const;

export function PacketScreen({ phase, memoId }: { phase: "cash-put" | "shares-held"; memoId: string }) {
  const view = useSuspenseQuery(memoQuery(memoId)).data;
  const search = useSearch({ strict: false }) as { candidate?: string };
  const ranked = view.candidates.filter((c) => c.rank !== null);
  const [pick, setPick] = useState(search.candidate ?? ranked[0]?.candidate_id ?? "");
  const [plan, setPlan] = useState(view.memo.precommit_plan ?? "");
  const [skipCode, setSkipCode] = useState<(typeof SKIP)[number][0]>("premium_below_tbill");
  const [note, setNote] = useState("");
  const cand = view.candidates.find((c) => c.candidate_id === pick) ?? ranked[0];
  const navigate = useNavigate();
  const scr: ScrId = phase === "shares-held" ? "SCR-037" : "SCR-032";
  const putCall = phase === "shares-held" ? "C" : "P";

  const goDraft = async (row: DraftView) => {
    const id = row.draft.draft_id;
    if (row.draft.status === "blocked") await navigate({ to: "/execute/draft-coach/$draftId", params: { draftId: id } });
    else if (putCall === "C") await navigate({ to: "/decide/call-ticket/$draftId", params: { draftId: id } });
    else await navigate({ to: "/execute/put-playbook/$draftId", params: { draftId: id } });
  };
  const prepare = useIntent(async (_: void, key) => {
    if (!cand) throw new Error("no candidate");
    const row = await unwrap(api.drafts.$post({ json: {
      memo_id: memoId, candidate_id: cand.candidate_id, side: "SELL", open_close: "open", put_call: putCall,
      qty: 1, strike: cand.strike, expiry: cand.expiry, limit_price: cand.limit_price, order_type: "LMT", tif: "DAY",
      precommit_plan: plan,
    } }, idem(key))) as DraftView;
    await goDraft(row);
    return row;
  }, { invalidate: [...AFTER_WHEEL], caps: true });
  const skip = useIntent((_: void, key) => unwrap(api.memos[":id"].skip.$post({ param: { id: memoId }, json: { code: skipCode, note: note || undefined } }, idem(key))),
    { invalidate: [...AFTER_WHEEL] });
  const wait = useIntent((_: void, key) => unwrap(api.memos[":id"].decide.$post({ param: { id: memoId }, json: { decision: "wait", rationale: note || undefined } }, idem(key))),
    { invalidate: [...AFTER_WHEEL] });

  const reasons: string[] = [];
  if (!view.packet.has_crash) reasons.push("Attach a crash replay");
  if (!view.packet.has_mc) reasons.push("Attach a Monte Carlo run");
  if (putCall === "P" && plan.trim().length < 10) reasons.push("Write the plan for a sharp drop (10+ characters)");
  if (!cand) reasons.push("Score a chain with at least one ranked strike");
  if (view.frozen) reasons.push("This memo is frozen");

  return (
    <Screen scr={scr} eyebrow="Packet" title={phase === "shares-held" ? "Covered-call packet" : "Put packet"} nav={DECIDE_NAV}
      lead="Three numbers, both stress runs, and a written plan. Then skip, wait, or prepare a draft you still place yourself.">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge status={view.memo.status} />
        {view.memo.decision && <StatusBadge status={view.memo.decision} />}
        <span className="text-muted">{view.envelope.label}</span>
        {view.basis && <BasisLockBanner basis={view.basis.basis} strike={cand?.strike ?? view.basis.basis} />}
      </div>
      {cand && (
        <>
          <Field label="Strike" htmlFor="pick">
            <Select id="pick" value={cand.candidate_id} onChange={(e) => setPick(e.target.value)}>
              {ranked.map((c) => <option key={c.candidate_id} value={c.candidate_id}>#{c.rank} · {c.strike} · {c.expiry} · bid {c.limit_price}</option>)}
            </Select>
          </Field>
          <Numbers cand={cand} putCall={putCall} basis={view.basis?.basis} />
          <YieldStack premiumYieldAnn={Number(cand.premium_yield_ann)} periodYield={null} dte={cand.dte}
            tbill={view.inputs.rate?.cited ? { rate: String(view.inputs.rate.rate), as_of: view.inputs.rate.as_of, source_url: view.inputs.rate.source_url ?? "", kind: "cited" } : null} />
        </>
      )}
      <StressSlots view={view} />
      <Field label="Plan if QQQ drops hard" htmlFor="plan" hint="Ten characters or more. This is stored on the memo and the draft.">
        <textarea id="plan" className="min-h-24 w-full rounded-control border border-control/50 bg-raised px-3 py-2 text-sm" value={plan} disabled={view.frozen} onChange={(e) => setPlan(e.target.value)} />
      </Field>
      <DecisionBar busy={prepare.isPending} prepareDisabledReasons={reasons} prepareLabel={putCall === "C" ? "Prepare call draft" : "Prepare put draft"}
        onPrepare={() => prepare.mutate()}
        onSkip={() => skip.mutate()}
        onWait={() => wait.mutate()} />
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Field label="Skip reason" htmlFor="skip">
          <Select id="skip" value={skipCode} onChange={(e) => setSkipCode(e.target.value as typeof skipCode)}>
            {SKIP.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Note" htmlFor="note"><TextInput id="note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <Err error={prepare.error ?? skip.error ?? wait.error} />
      {view.drafts[0] && (
        <p className="text-sm">Existing draft <StatusBadge status={view.drafts[0].status} />{" "}
          <Link className="font-medium text-accent hover:underline" to="/execute/draft-coach/$draftId" params={{ draftId: view.drafts[0].draft_id }}>Open</Link>
        </p>
      )}
    </Screen>
  );
}

function Numbers({ cand, putCall, basis }: { cand: Candidate; putCall: "P" | "C"; basis?: string }) {
  if (putCall === "P") {
    return <TicketThreeNumbers inv={{ kind: "put", reserve: cand.reserve_usd, maxProfit: cand.max_profit_usd, breakEven: cand.break_even, worstCase: cand.worst_case_usd }} />;
  }
  return <TicketThreeNumbers inv={{ kind: "call", sharesCovered: 100, creditOnly: cand.max_profit_usd, maxProfit: cand.max_profit_usd, worstCase: cand.worst_case_usd, lockedLoss: basis ? Number(cand.strike) < Number(basis) : false, basis: basis ?? "0" }} />;
}

function StressSlots({ view }: { view: { stress: { kind: string; result_id: string; headline: Record<string, unknown>; model_version: string }[]; packet: { has_crash: boolean; has_mc: boolean } } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(["crash", "mc"] as const).map((kind) => {
        const s = view.stress.find((x) => x.kind === kind);
        return (
          <Card key={kind}>
            <CardBody>
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">{kind === "crash" ? "Crash replay" : "Monte Carlo"}</p>
              {s ? (
                <>
                  <ClaimLabel label="sourced_sim">{s.model_version}</ClaimLabel>
                  <StressHeadline kind={kind} headline={s.headline} />
                </>
              ) : (
                <p className="mt-2 text-sm text-caution">Not attached. Run it under Simulate, then attach this memo.</p>
              )}
              <Link
                to={kind === "crash" ? "/simulate/crash" : "/simulate/monte-carlo"}
                className="mt-2 inline-block text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {kind === "crash" ? "Open crash" : "Open Monte Carlo"}
              </Link>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

function StressHeadline({ kind, headline }: { kind: "crash" | "mc"; headline: Record<string, unknown> }) {
  const assigned = headline.assigned && typeof headline.assigned === "object" ? (headline.assigned as Record<string, unknown>) : null;
  const csp = headline.csp && typeof headline.csp === "object" ? (headline.csp as Record<string, unknown>) : null;
  const rows =
    kind === "crash"
      ? [
          { label: "Scenario", value: headline.scenario != null ? String(headline.scenario) : "—" },
          { label: "Assigned", value: assigned?.date != null ? String(assigned.date) : "Not assigned" },
          { label: "Basis", value: assigned?.basis != null ? Number(assigned.basis).toFixed(2) : "—" },
          { label: "CSP return", value: typeof csp?.ret === "number" ? fmtPct(csp.ret) : "—" },
        ]
      : [
          { label: "CAGR p50", value: fmtPct(headline.cagr_p50) },
          { label: "CAGR p05", value: fmtPct(headline.cagr_p05) },
          { label: "P(below start)", value: fmtPct(headline.p_below_start) },
          { label: "Median max DD", value: fmtPct(headline.median_max_dd) },
        ];
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {rows.map((r) => (
        <div key={r.label} className="min-w-0">
          <p className="text-[0.7rem] font-medium text-muted">{r.label}</p>
          <p className="num mt-0.5 truncate text-sm font-semibold text-ink" title={r.value}>
            {r.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function fmtPct(v: unknown): string {
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}
