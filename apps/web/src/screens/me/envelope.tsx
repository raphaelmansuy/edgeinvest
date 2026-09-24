import { OVERRIDE_PHRASE } from "@edge/contracts";
import { ENVELOPES } from "@edge/domain";
import { Button, Card, CardBody, RadioCard, TypedConfirm } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Err, ME_NAV, Screen, Stamp } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { envelopeQuery, qk } from "../../lib/queries";
import { useCaps } from "../../lib/screen";

export function EnvelopeScreen() {
  const caps = useCaps();
  const history = useSuspenseQuery(envelopeQuery()).data as { envelope_id: string; valid_from: string; valid_to: string | null; override_before_mastery: boolean }[];
  const [pick, setPick] = useState(caps.envelope_id);
  const save = useIntent((phrase: string | undefined, key) => unwrap(api.me.envelope.$patch({ json: {
    envelope_id: pick, override: pick === "mentor_cyrille_v1" && !caps.mentor_selectable, confirm_phrase: phrase,
  } }, idem(key))), { invalidate: [qk.envelope], caps: true });
  const mentorLocked = pick === "mentor_cyrille_v1" && !caps.mentor_selectable;

  return (
    <Screen scr="SCR-071" eyebrow="Me" title="Strike envelope" nav={ME_NAV}
      lead="Beginner is the default. Mentor stays locked until mastery, unless you type the override. The choice is audited.">
      <div className="grid gap-3">
        {Object.values(ENVELOPES).map((e) => (
          <RadioCard key={e.id} name="env" value={e.id} checked={pick === e.id} onChange={() => setPick(e.id)}
            title={e.label} meta={`${(e.otmMin * 100).toFixed(0)}–${(e.otmMax * 100).toFixed(0)} % OTM · ${e.dteMin}–${e.dteMax} DTE`}
            badge={e.requiresMastery ? (caps.mentor_selectable ? "unlocked" : "locked") : undefined} />
        ))}
      </div>
      {mentorLocked
        ? <TypedConfirm phrase={OVERRIDE_PHRASE} label="Use Mentor without mastery" busy={save.isPending} onConfirm={() => save.mutate(OVERRIDE_PHRASE)} />
        : <Button variant="primary" disabled={save.isPending || pick === caps.envelope_id} onClick={() => save.mutate(undefined)}>Save envelope</Button>}
      <Err error={save.error} />
      <Card>
        <CardBody>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">History</p>
          <ul className="space-y-1 text-sm">{history.map((h, i) => (
            <li key={i} className="flex justify-between"><span>{h.envelope_id}{h.override_before_mastery ? " · override" : ""}</span><Stamp at={h.valid_from} /></li>
          ))}</ul>
        </CardBody>
      </Card>
    </Screen>
  );
}
