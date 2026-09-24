import { LOCKED_LOSS_PHRASE } from "@edge/contracts";
import { Button, Card, CardBody, CardHeader, EmptyState, HaltBanner, TypedConfirm } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Err, Screen, StatusBadge } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { AFTER_WHEEL, memosQuery, wheelQuery } from "../../lib/queries";

export function HaltScreen() {
  const wheel = useSuspenseQuery(wheelQuery()).data;
  const memos = useSuspenseQuery(memosQuery()).data;
  const clear = useIntent((_: void, key) => unwrap(api.wheel.halt.$delete({}, idem(key))), { invalidate: [...AFTER_WHEEL], caps: true });
  const accept = useIntent((cycleId: string, key) => unwrap(api.wheel["locked-loss-accept"].$post({ json: { cycle_id: cycleId, phrase: LOCKED_LOSS_PHRASE } }, idem(key))),
    { invalidate: [...AFTER_WHEEL], caps: true });
  const drafts = memos.items.map((m) => m.draft).filter((d): d is NonNullable<typeof d> => Boolean(d) && (d!.status === "open" || d!.status === "blocked"));

  return (
    <Screen scr="SCR-045" eyebrow="Execute" title="Halt, veto, open work"
      lead="A halt clears only when its condition is gone. A locked-loss call needs the typed phrase.">
      {wheel.halt ? (
        <div className="flex flex-col gap-3">
          <HaltBanner reason={wheel.halt.reason} />
          <Button variant="primary" disabled={clear.isPending} onClick={() => clear.mutate()}>Clear halt</Button>
          <Err error={clear.error} />
        </div>
      ) : <p className="text-sm text-ok">No halt is active.</p>}

      {wheel.vetoes.map((v) => (
        <Card key={v.draft_id}>
          <CardHeader title={`Locked-loss call ${v.strike}`} eyebrow={v.expiry} />
          <CardBody className="flex flex-col gap-3">
            <p className="text-sm text-muted">Strike is below basis. Accepting it is audited and applies to this cycle only.</p>
            <TypedConfirm phrase={LOCKED_LOSS_PHRASE} label="Accept locked loss" busy={accept.isPending} onConfirm={() => wheel.basis && accept.mutate(wheel.basis.cycle_id)} />
          </CardBody>
        </Card>
      ))}

      <Card>
        <CardHeader title="Open drafts" />
        <CardBody>
          {drafts.length === 0 ? <EmptyState title="No open draft" teach="Prepare one from a packet when the phase allows it." /> : (
            <ul className="divide-y divide-hair text-sm">
              {drafts.map((d) => (
                <li key={d.draft_id} className="flex items-center justify-between py-2">
                  <Link className="font-medium hover:text-accent" to={d.status === "blocked" ? "/execute/draft-coach/$draftId" : d.put_call === "C" ? "/execute/call-playbook/$draftId" : "/execute/put-playbook/$draftId"} params={{ draftId: d.draft_id }}>
                    {d.put_call} {d.strike}
                  </Link>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Open cycles" />
        <CardBody>
          {wheel.cycles.length === 0 ? <p className="text-sm text-muted">No open cycle.</p> : (
            <ul className="divide-y divide-hair text-sm">
              {wheel.cycles.map((c) => (
                <li key={c.cycle_id} className="flex justify-between py-2">
                  <Link className="font-medium hover:text-accent" to={c.open_leg?.put_call === "C" ? "/execute/short-call-life/$cycleId" : "/execute/short-put-life/$cycleId"} params={{ cycleId: c.cycle_id }}>
                    {c.state} {c.open_leg ? `· ${c.open_leg.put_call} ${c.open_leg.strike}` : ""}
                  </Link>
                  <span className="text-muted">{c.mode}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <Err error={accept.error} />
    </Screen>
  );
}
