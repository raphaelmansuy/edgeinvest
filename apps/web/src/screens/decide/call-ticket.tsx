import { Button, Card, CardBody, TicketThreeNumbers } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Screen, StatusBadge } from "../../components/kit";
import { draftQuery } from "../../lib/queries";

export function CallTicketScreen({ draftId }: { draftId: string }) {
  const d = useSuspenseQuery(draftQuery(draftId)).data;
  const inv = d.invariants;
  return (
    <Screen scr="SCR-038" eyebrow="Call ticket" title={`SELL 1 QQQ ${d.draft.expiry} ${d.draft.strike} call`}
      lead="Limit at the bid. You still type this into IBKR. The playbook is the tap order."
      actions={<StatusBadge status={d.draft.status} />}>
      {inv?.kind === "call" && (
        <TicketThreeNumbers inv={{ kind: "call", sharesCovered: inv.shares_covered, creditOnly: inv.credit, maxProfit: inv.max_profit, worstCase: inv.worst_case, lockedLoss: inv.locked_loss, basis: inv.basis }} />
      )}
      <Card><CardBody className="text-sm">
        <p>Side {d.draft.side} · {d.draft.order_type} {d.draft.limit_price} · {d.draft.tif} · qty {d.draft.qty}</p>
        {d.memo?.precommit_plan && <p className="mt-2 text-muted">Plan: {d.memo.precommit_plan}</p>}
      </CardBody></Card>
      <Link to="/execute/call-playbook/$draftId" params={{ draftId }}><Button variant="primary">Open the call playbook</Button></Link>
    </Screen>
  );
}
