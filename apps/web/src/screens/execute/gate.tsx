import { LIVE_PHRASE } from "@edge/contracts";
import { HUMAN_GATE_CHECKS } from "@edge/content";
import { Button, Card, CardBody, Checkbox, Field, MoneyInput, TextInput, TypedConfirm, moneyError } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Err, Screen, StatusBadge } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { AFTER_WHEEL, draftQuery } from "../../lib/queries";

export function GateScreen({ draftId }: { draftId: string }) {
  const d = useSuspenseQuery(draftQuery(draftId)).data;
  const checks = HUMAN_GATE_CHECKS({ putCall: d.draft.put_call, qty: d.draft.qty, strike: d.draft.strike, expiry: d.draft.expiry, limit: d.draft.limit_price, dte: d.dte, mode: d.draft.account_mode });
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [price, setPrice] = useState(d.draft.limit_price);
  const [when, setWhen] = useState(new Date().toISOString().slice(0, 16));
  const all = checks.every((c) => ticked[c.id]);
  const gate = useIntent((phrase: string | undefined, key) => unwrap(api.drafts[":id"]["human-gate"].$post({ param: { id: draftId }, json: { confirm: true, live_phrase: phrase } }, idem(key))),
    { invalidate: [["execute", "draft", draftId]], caps: true });
  const fill = useIntent((_: void, key) => unwrap(api.drafts[":id"].fill.$post({ param: { id: draftId }, json: { price, filled_at: new Date(when).toISOString() } }, idem(key))),
    { invalidate: [...AFTER_WHEEL], caps: true });
  const discard = useIntent((_: void, key) => unwrap(api.drafts[":id"].$delete({ param: { id: draftId } }, idem(key))),
    { invalidate: [...AFTER_WHEEL], caps: true });
  const status = gate.data?.draft.status ?? d.draft.status;

  return (
    <Screen scr="SCR-042" eyebrow="Human gate" title="You submit in IBKR. Then record the fill."
      lead="Every box is what the IBKR preview showed. Live mode also asks you to type the phrase."
      actions={<StatusBadge status={status} />}>
      <Card>
        <CardBody className="flex flex-col gap-3">
          {checks.map((c) => (
            <Checkbox key={c.id} label={c.text} checked={!!ticked[c.id]} onChange={(e) => setTicked({ ...ticked, [c.id]: e.target.checked })} />
          ))}
          {d.draft.account_mode === "live"
            ? <TypedConfirm phrase={LIVE_PHRASE} label="I submitted this in IBKR" busy={gate.isPending} variant="primary" onConfirm={() => all && gate.mutate(LIVE_PHRASE)} />
            : <Button variant="primary" disabled={!all || gate.isPending || status !== "open"} onClick={() => gate.mutate(undefined)}>I submitted this in IBKR</Button>}
        </CardBody>
      </Card>
      {status === "submitted_by_user" && !d.fill && (
        <Card>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Field label="Fill price" htmlFor="px" error={moneyError(price, { positive: true, tick: true })}>
              <MoneyInput id="px" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <Field label="Filled at" htmlFor="at"><TextInput id="at" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
            <Button variant="primary" disabled={!!moneyError(price, { positive: true, tick: true }) || fill.isPending} onClick={() => fill.mutate()}>Record fill</Button>
          </CardBody>
        </Card>
      )}
      {d.fill && <p className="text-sm text-ok">Fill recorded at {d.fill.open_price}.</p>}
      {!d.fill && status !== "discarded" && <Button variant="ghost" disabled={discard.isPending} onClick={() => discard.mutate()}>Discard draft</Button>}
      <Err error={gate.error ?? fill.error ?? discard.error} />
    </Screen>
  );
}
