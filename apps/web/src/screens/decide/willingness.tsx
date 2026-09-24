import { Button, Card, CardBody, Field, MoneyText, TextInput } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DECIDE_NAV, Err, Screen } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { AFTER_WHEEL, wheelQuery } from "../../lib/queries";
import { useState } from "react";

export function WillingnessScreen() {
  const wheel = useSuspenseQuery(wheelQuery()).data;
  const [statement, setStatement] = useState("");
  const save = useIntent((willing: boolean, key) => unwrap(api.wheel.willingness.$post({ json: { willing, statement: statement || undefined } }, idem(key))),
    { invalidate: [...AFTER_WHEEL], caps: true });
  return (
    <Screen scr="SCR-035" eyebrow="Shares" title="Would you keep these shares?" nav={DECIDE_NAV}
      lead="A covered call only makes sense if you are willing to hold through a further drop. Declining raises a halt until you say yes.">
      {wheel.basis && (
        <Card><CardBody>
          <p className="text-sm text-muted">Decision basis</p>
          <p className="text-2xl font-semibold"><MoneyText value={wheel.basis.basis} /> <span className="text-base font-normal text-muted">× {wheel.basis.qty}</span></p>
        </CardBody></Card>
      )}
      <Field label="In your words (optional)" htmlFor="st">
        <TextInput id="st" value={statement} onChange={(e) => setStatement(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate(true)}>Yes, I will hold them</Button>
        <Button variant="danger" disabled={save.isPending} onClick={() => save.mutate(false)}>No — halt new drafts</Button>
      </div>
      {wheel.willingness_confirmed_at && <p className="text-sm text-ok">Willingness is on record.</p>}
      <Err error={save.error} />
    </Screen>
  );
}
