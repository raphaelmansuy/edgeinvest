import { Badge, Button, Card, CardBody, MoneyText, Pct } from "@edge/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { DECIDE_NAV, Err, Screen } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { AFTER_WHEEL, memoQuery, memosQuery } from "../../lib/queries";
import type { MemoView } from "../../lib/shapes";

export function CandidatesScreen({ phase }: { phase: "cash-put" | "shares-held" }) {
  const navigate = useNavigate();
  const list = useQuery(memosQuery({ phase }));
  const building = list.data?.items.find((m) => m.status === "building");
  const ensure = useIntent(async (_: void, key) => {
    const row = building ?? await unwrap<{ memo_id: string }>(api.memos.$post({ json: { phase } }, idem(key)));
    const scored = await unwrap<MemoView>(api.memos[":id"]["candidates:score"].$post({ param: { id: row.memo_id } }, idem(crypto.randomUUID())));
    return scored;
  }, { invalidate: [...AFTER_WHEEL] });
  const memoId = ensure.data?.memo.memo_id ?? building?.memo_id;
  const detail = useQuery({ ...memoQuery(memoId ?? "none"), enabled: Boolean(memoId) && !ensure.data });
  const view = ensure.data ?? detail.data;
  const packetTo = phase === "shares-held" ? "/decide/call-packet/$memoId" : "/decide/packet/$memoId";
  const scr = phase === "shares-held" ? "SCR-036" : "SCR-031";

  return (
    <Screen scr={scr} eyebrow="Decide" title={phase === "shares-held" ? "Call candidates" : "Put candidates"} nav={DECIDE_NAV}
      lead="Ranked rows are inside the envelope and above the T-bill hurdle. Rejected rows stay visible, with the reason."
      actions={<Button variant="primary" disabled={ensure.isPending} onClick={() => ensure.mutate()}>{view ? "Rescore" : "Score chain"}</Button>}>
      <Err error={ensure.error} />
      {view && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">{view.envelope.label} · OTM {(view.envelope.otm_min * 100).toFixed(0)}–{(view.envelope.otm_max * 100).toFixed(0)} % · {view.envelope.dte_min}–{view.envelope.dte_max} DTE</p>
            <Link to={packetTo} params={{ memoId: view.memo.memo_id }} search={{ candidate: undefined }}><Button size="sm">Open packet</Button></Link>
          </div>
          <CandidateTable view={view} onPick={(id) => navigate({ to: packetTo, params: { memoId: view.memo.memo_id }, search: { candidate: id } })} />
        </>
      )}
    </Screen>
  );
}

function CandidateTable({ view, onPick }: { view: MemoView; onPick: (id: string) => void }) {
  const ranked = view.candidates.filter((c) => c.rank !== null);
  const rejected = view.candidates.filter((c) => c.rank === null);
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-card border border-hair">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs text-muted">
            <tr>{["Rank", "Strike", "Expiry", "DTE", "OTM", "Bid", "Yield", "Reserve", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {ranked.map((c) => (
              <tr key={c.candidate_id}>
                <td className="num px-3 py-2">{c.rank}</td>
                <td className="num px-3 py-2 font-medium"><MoneyText value={c.strike} /></td>
                <td className="num px-3 py-2">{c.expiry}</td>
                <td className="num px-3 py-2">{c.dte}</td>
                <td className="num px-3 py-2"><Pct value={c.otm_pct} /></td>
                <td className="num px-3 py-2"><MoneyText value={c.limit_price} /></td>
                <td className="num px-3 py-2"><Pct value={c.premium_yield_ann} /></td>
                <td className="num px-3 py-2"><MoneyText value={c.reserve_usd} /></td>
                <td className="px-3 py-2"><Button size="sm" variant="quiet" onClick={() => onPick(c.candidate_id)}>Use</Button></td>
              </tr>
            ))}
            {ranked.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-muted">Nothing ranked. Rejected rows are below.</td></tr>}
          </tbody>
        </table>
      </div>
      {rejected.length > 0 && (
        <Card><CardBody>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Rejected</p>
          <ul className="space-y-1 text-sm">{rejected.map((c) => (
            <li key={c.candidate_id} className="flex justify-between gap-3"><span className="num">{c.strike} · {c.expiry}</span><span>{c.reject_reasons.map((r) => <Badge key={r} tone="caution">{r}</Badge>)}</span></li>
          ))}</ul>
        </CardBody></Card>
      )}
      {view.unpriced.length > 0 && (
        <p className="text-sm text-muted">{view.unpriced.length} quote{view.unpriced.length === 1 ? "" : "s"} had no bid and were not scored (NO_BID).</p>
      )}
    </div>
  );
}
