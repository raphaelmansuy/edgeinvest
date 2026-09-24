import { Button, Card, CardBody, MoneyText, Stat } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Err, Screen } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { AFTER_WHEEL, cycleQuery } from "../../lib/queries";

const CYCLE_LABEL: Record<string, string> = {
  none: "No open cycle",
  short_put_open: "Short put open",
  shares_held: "Shares held",
  shares_short_call: "Covered call open",
  closed: "Closed",
};

export function AssignmentScreen({ cycleId }: { cycleId: string }) {
  const data = useSuspenseQuery(cycleQuery(cycleId)).data as {
    cycle: { state: string }; legs: { put_call: string; strike: string; open_price: string; closed_at: string | null }[]; lot: { cost_basis: string; qty: number } | null;
  };
  const put = data.legs.find((l) => l.put_call === "P");
  const basis = put ? (Number(put.strike) - Number(put.open_price)).toFixed(4) : null;
  const canAssign = data.cycle.state === "short_put_open";
  const navigate = useNavigate();
  const assign = useIntent(async (_: void, key) => {
    await unwrap(api.cycles[":id"].events.$post({ param: { id: cycleId }, json: { event: "assigned", at: new Date().toISOString() } }, idem(key)));
    await navigate({ to: "/decide/willingness" });
  }, { invalidate: [...AFTER_WHEEL], caps: true });

  return (
    <Screen scr="SCR-034" eyebrow="Shares" title="Assignment" lead="If IBKR assigned the put, record it here. Decision basis is the strike minus the premium you already kept.">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Put strike"><MoneyText value={put?.strike} /></Stat>
        <Stat label="Premium kept"><MoneyText value={put?.open_price} /></Stat>
        <Stat label="Decision basis"><MoneyText value={basis} /></Stat>
      </div>
      <Card>
        <CardBody className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            {CYCLE_LABEL[data.cycle.state] ?? data.cycle.state}.{" "}
            {data.lot ? `Lot basis ${data.lot.cost_basis} for ${data.lot.qty} shares.` : "No share lot yet."}
          </p>
          <Button variant="primary" disabled={assign.isPending || !canAssign} onClick={() => assign.mutate()}>
            Record assignment
          </Button>
          <Err error={assign.error} />
        </CardBody>
      </Card>
    </Screen>
  );
}
