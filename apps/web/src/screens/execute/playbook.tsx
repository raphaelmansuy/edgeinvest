import type { ScrId } from "@edge/contracts";
import { playbookFor } from "@edge/content";
import { Button, StepCoach, TicketThreeNumbers } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Err, Screen, StatusBadge } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { AFTER_WHEEL, draftQuery } from "../../lib/queries";
import type { DraftView } from "../../lib/shapes";

export function PlaybookScreen({ draftId, putCall }: { draftId: string; putCall: "P" | "C" }) {
  const d = useSuspenseQuery(draftQuery(draftId)).data;
  const scr: ScrId = putCall === "P" ? "SCR-040" : "SCR-043";
  const steps = playbookFor(d.draft.put_call, d.draft.account_mode);
  const toggle = useIntent((v: { step: string; done: boolean }, key) => unwrap(api.drafts[":id"].steps.$post({ param: { id: draftId }, json: v }, idem(key))),
    { invalidate: [qkDraft(draftId)] });
  const missing = useIntent((_: void, key) => unwrap(api.drafts[":id"].steps.$post({ param: { id: draftId }, json: { step: "pre.paper_bar_missing", done: true } }, idem(key))),
    { invalidate: [...AFTER_WHEEL], caps: true });

  return (
    <Screen scr={scr} eyebrow={d.draft.account_mode === "paper" ? "Paper playbook" : "Live playbook"}
      title={`${d.draft.side} 1 QQQ ${d.draft.expiry} ${d.draft.strike} ${putCall === "P" ? "put" : "call"}`}
      lead="Do each tap in IBKR, then tick it here. EdgeInvest does not open IBKR and does not send the order."
      actions={<StatusBadge status={d.draft.status} />}>
      <Numbers d={d} />
      <StepCoach steps={steps.map((s) => ({ id: s.id, title: s.text({ putCall: d.draft.put_call, qty: d.draft.qty, strike: d.draft.strike, expiry: d.draft.expiry, limit: d.draft.limit_price, dte: d.dte, mode: d.draft.account_mode }), detail: s.group === "precheck" ? "Pre-check" : "In IBKR" }))}
        done={d.draft.steps_done ?? []} busy={toggle.isPending} onToggle={(id, done) => toggle.mutate({ step: id, done })} />
      {d.draft.account_mode === "paper" && d.draft.status === "open" && (
        <Button variant="danger" disabled={missing.isPending} onClick={() => missing.mutate()}>The SIMULATED bar is missing</Button>
      )}
      <div className="flex gap-3">
        <Link to="/execute/human-gate/$draftId" params={{ draftId }}><Button variant="primary" disabled={!d.steps_complete || d.draft.status !== "open"}>Human gate</Button></Link>
        <Link to="/execute/draft-coach/$draftId" params={{ draftId }} className="text-sm font-medium text-accent hover:underline self-center">Draft coach</Link>
      </div>
      <Err error={toggle.error ?? missing.error} />
    </Screen>
  );
}

function qkDraft(id: string) {
  return ["execute", "draft", id] as const;
}

function Numbers({ d }: { d: DraftView }) {
  const inv = d.invariants;
  if (!inv) return null;
  if (inv.kind === "put") return <TicketThreeNumbers inv={{ kind: "put", reserve: inv.reserve, maxProfit: inv.max_profit, breakEven: inv.break_even, worstCase: inv.worst_case }} />;
  return <TicketThreeNumbers inv={{ kind: "call", sharesCovered: inv.shares_covered, creditOnly: inv.credit, maxProfit: inv.max_profit, worstCase: inv.worst_case, lockedLoss: inv.locked_loss, basis: inv.basis }} />;
}
