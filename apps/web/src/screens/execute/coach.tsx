import { Button, Card, CardBody, ChecklistPanel } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Err, Screen, StatusBadge } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { AFTER_WHEEL, draftQuery } from "../../lib/queries";

export function CoachScreen({ draftId }: { draftId: string }) {
  const d = useSuspenseQuery(draftQuery(draftId)).data;
  const review = useIntent((_: void, key) => unwrap(api.drafts[":id"].review.$post({ param: { id: draftId } }, idem(key))),
    { invalidate: [["execute", "draft", draftId], ...AFTER_WHEEL], caps: true });
  const results = d.draft.checklist?.results ?? [];
  const play = d.draft.put_call === "C" ? "/execute/call-playbook/$draftId" : "/execute/put-playbook/$draftId";
  return (
    <Screen scr="SCR-041" eyebrow="Draft coach" title="Why this draft is blocked, or why it is clear"
      lead="Re-check runs the same rules as the first preview. A blocked draft cannot pass the human gate."
      actions={<StatusBadge status={d.draft.status} />}>
      {d.draft.block_reasons.length > 0 && (
        <ul className="flex flex-wrap gap-2">{d.draft.block_reasons.map((r) => <li key={r} className="rounded-full bg-loss/10 px-3 py-1 text-sm font-medium text-loss">{r}</li>)}</ul>
      )}
      <Card><CardBody>{results.length ? <ChecklistPanel results={results} /> : <p className="text-sm text-muted">No checklist stored. Re-check to refresh it.</p>}</CardBody></Card>
      <div className="flex gap-3">
        <Button variant="primary" disabled={review.isPending || !["open", "blocked"].includes(d.draft.status)} onClick={() => review.mutate()}>Re-check</Button>
        <Link to={play} params={{ draftId }}><Button>Playbook</Button></Link>
      </div>
      <Err error={review.error} />
    </Screen>
  );
}
