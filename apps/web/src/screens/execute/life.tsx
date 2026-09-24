import type { ScrId } from "@edge/contracts";
import { Button, Card, CardBody, Field, MoneyInput, MoneyText, Select, TextInput } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Err, Screen, num } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { AFTER_WHEEL, cycleQuery } from "../../lib/queries";

type Ev = "expired" | "bought_back" | "assigned" | "called_away" | "shares_sold";

export function CycleLifeScreen({ cycleId, putCall }: { cycleId: string; putCall: "P" | "C" }) {
  const data = useSuspenseQuery(cycleQuery(cycleId)).data as {
    cycle: { state: string; mode: string; opened_at: string };
    open_leg: { put_call: string; strike: string; expiry: string; open_price: string } | null;
    legs: { put_call: string; strike: string; open_price: string; close_reason: string | null }[];
    ledger: { kind: string; amount_usd: string; trade_date: string }[];
    plan: string | null;
    spot: { spot: string; as_of: string } | null;
  };
  const scr: ScrId = putCall === "P" ? "SCR-103" : "SCR-044";
  const events: Ev[] = putCall === "P" ? ["expired", "bought_back", "assigned"] : ["expired", "bought_back", "called_away", "shares_sold"];
  const [event, setEvent] = useState<Ev>(events[0]!);
  const [price, setPrice] = useState("1.00");
  const [at, setAt] = useState(new Date().toISOString().slice(0, 16));
  const record = useIntent((_: void, key) => {
    const when = new Date(at).toISOString();
    const json = event === "bought_back" || event === "shares_sold"
      ? { event, at: when, price }
      : { event, at: when };
    return unwrap(api.cycles[":id"].events.$post({ param: { id: cycleId }, json }, idem(key)));
  }, { invalidate: [...AFTER_WHEEL], caps: true });

  return (
    <Screen scr={scr} eyebrow={data.cycle.mode} title={putCall === "P" ? "Short put" : "Short call"}
      lead={data.plan ?? "Record what IBKR actually did. The state machine refuses an event that does not belong here."}>
      {data.open_leg && (
        <Card><CardBody className="grid gap-2 text-sm sm:grid-cols-4">
          <p>Strike <span className="num font-semibold"><MoneyText value={data.open_leg.strike} /></span></p>
          <p>Open <span className="num font-semibold"><MoneyText value={data.open_leg.open_price} /></span></p>
          <p>Expiry <span className="num font-semibold">{data.open_leg.expiry}</span></p>
          <p>Spot <span className="num font-semibold">{data.spot ? num(data.spot.spot) : "—"}</span></p>
        </CardBody></Card>
      )}
      <p className="text-sm text-muted">State {data.cycle.state}</p>
      {data.open_leg && (
        <Card>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field label="What happened" htmlFor="ev">
              <Select id="ev" value={event} onChange={(e) => setEvent(e.target.value as Ev)}>
                {events.map((e) => <option key={e} value={e}>{e.replaceAll("_", " ")}</option>)}
              </Select>
            </Field>
            <Field label="When" htmlFor="when"><TextInput id="when" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></Field>
            {(event === "bought_back" || event === "shares_sold") && (
              <Field label="Price" htmlFor="px"><MoneyInput id="px" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
            )}
            <Button variant="primary" disabled={record.isPending} onClick={() => record.mutate()}>Record</Button>
            {event === "assigned" && <Link to="/decide/assignment/$cycleId" params={{ cycleId }} className="text-sm font-medium text-accent hover:underline self-center">Preview basis first</Link>}
          </CardBody>
        </Card>
      )}
      <Err error={record.error} />
      <Card>
        <CardBody>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Ledger on this cycle</p>
          <ul className="divide-y divide-hair text-sm">{data.ledger.map((e, i) => (
            <li key={i} className="flex justify-between py-1.5"><span>{e.trade_date} · {e.kind}</span><MoneyText value={e.amount_usd} sign /></li>
          ))}</ul>
        </CardBody>
      </Card>
    </Screen>
  );
}
