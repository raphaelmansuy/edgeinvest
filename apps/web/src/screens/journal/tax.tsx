import { COPY_VERSION } from "@edge/copy";
import { Button, Card, CardBody, Checkbox, Field, MoneyText, SignedBars, TextInput } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { JOURNAL_NAV, Screen } from "../../components/kit";
import { api, idem, rawFetch, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { disclosuresQuery, ledgerQuery, qk } from "../../lib/queries";

export function TaxScreen() {
  const data = useSuspenseQuery(ledgerQuery("hk_yoa")).data;
  const disc = useSuspenseQuery(disclosuresQuery()).data;
  const taxAck = disc.disclosures.find((d: { key: string }) => d.key === "tax.not_advice");
  const ack = useIntent((_: void, key) => unwrap(api.me.disclosures[":key"].ack.$post({ param: { key: "tax.not_advice" }, json: { copy_version: COPY_VERSION, scr: "SCR-051" } }, idem(key))),
    { invalidate: [qk.disclosures] });
  const [yoa, setYoa] = useState("");
  const download = async () => {
    const r = await rawFetch(`/journal/tax/hk.csv${yoa ? `?yoa=${encodeURIComponent(yoa)}` : ""}`);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "edgeinvest-hk.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const items = data.groups.map((g) => ({ label: g.label, credit: Number(g.credits), debit: Number(g.debits) }));

  return (
    <Screen scr="SCR-051" eyebrow="Journal" title="Hong Kong tax journal" nav={JOURNAL_NAV}
      lead="Facts and your notes. No verdict. Premium is not labelled as income or as capital.">
      <SignedBars items={items} caption="By year of assessment" />
      {!taxAck?.acked_at && (
        <Card><CardBody className="flex flex-col gap-2">
          <p className="text-sm">{taxAck?.body ?? "Acknowledge the tax disclosure before export."}</p>
          <Button size="sm" variant="primary" disabled={ack.isPending} onClick={() => ack.mutate()}>I have read this</Button>
        </CardBody></Card>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Year of assessment" htmlFor="yoa" hint="2025/26"><TextInput id="yoa" value={yoa} onChange={(e) => setYoa(e.target.value)} /></Field>
        <Button variant="secondary" disabled={!taxAck?.acked_at} onClick={() => void download()}>Download CSV</Button>
      </div>
      <div className="flex flex-col gap-3">
        {data.entries.map((e) => <Row key={e.entry_id} entry={e} />)}
      </div>
    </Screen>
  );
}

function Row({ entry }: { entry: { entry_id: string; trade_date: string; kind: string; amount_usd: string; hk_year_of_assessment: string; hk_note: string | null; badges_of_trade_flag: boolean } }) {
  const [note, setNote] = useState(entry.hk_note ?? "");
  const [flag, setFlag] = useState(entry.badges_of_trade_flag);
  const save = useIntent((_: void, key) => unwrap(api.ledger[":entryId"].annotation.$put({ param: { entryId: entry.entry_id }, json: { hk_note: note || null, badges_of_trade_flag: flag } }, idem(key))),
    { invalidate: [qk.ledger("hk_yoa")] });
  return (
    <Card>
      <CardBody className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <div className="text-sm">
          <p className="font-medium">{entry.hk_year_of_assessment} · {entry.kind}</p>
          <p className="text-muted">{entry.trade_date}</p>
          <p className="num"><MoneyText value={entry.amount_usd} sign /></p>
        </div>
        <div className="flex flex-col gap-2">
          <TextInput aria-label="HK note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for your adviser" />
          <Checkbox label="Flag for badges of trade" checked={flag} onChange={(e) => setFlag(e.target.checked)} />
          <Button size="sm" variant="secondary" disabled={save.isPending} onClick={() => save.mutate()}>Save note</Button>
        </div>
      </CardBody>
    </Card>
  );
}
