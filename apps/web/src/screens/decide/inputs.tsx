import { Button, Card, CardBody, CardHeader, Field, MoneyInput, Select, TextInput, moneyError } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DECIDE_NAV, Err, Screen, Stamp } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { AFTER_WHEEL, inputsQuery } from "../../lib/queries";
import { useCaps } from "../../lib/screen";

export function InputsScreen() {
  const caps = useCaps();
  const latest = useSuspenseQuery(inputsQuery()).data;
  return (
    <Screen scr="SCR-102" eyebrow="Decide" title="Cite the inputs" nav={DECIDE_NAV}
      lead="Account, chain and rate are captured by you. A rate without an https source is refused. A crossed or expired quote is refused with a pointer.">
      <div className="grid gap-4 lg:grid-cols-3">
        <AccountForm mode={caps.mode} current={latest.account} />
        <RateForm current={latest.rate} />
        <Card>
          <CardHeader title="Latest chain" />
          <CardBody className="text-sm">
            {latest.market ? (
              <>
                <p>Spot <span className="num font-semibold">{latest.market.spot}</span></p>
                <p className="text-muted"><Stamp at={latest.market.as_of} /> · {latest.market.quotes.length} quotes · {latest.market.source}</p>
              </>
            ) : <p className="text-muted">No market snapshot yet.</p>}
          </CardBody>
        </Card>
      </div>
      <ChainForm spot={latest.market?.spot ?? "721"} />
    </Screen>
  );
}

function AccountForm({ mode, current }: { mode: "paper" | "live"; current: { usd_settled_cash: string; hkd_cash: string; options_level: number; as_of: string } | null }) {
  const [usd, setUsd] = useState(current?.usd_settled_cash ?? "100000");
  const [hkd, setHkd] = useState(current?.hkd_cash ?? "0");
  const [level, setLevel] = useState(String(current?.options_level ?? 3));
  const save = useIntent((_: void, key) => unwrap(api.inputs["account-snapshots"].$post({ json: {
    mode, as_of: new Date().toISOString(), usd_settled_cash: usd, hkd_cash: hkd, options_level: Number(level),
  } }, idem(key))), { invalidate: [...AFTER_WHEEL], caps: true });
  return (
    <Card>
      <CardHeader title="Account" eyebrow={current ? <Stamp at={current.as_of} /> : "none yet"} />
      <CardBody className="flex flex-col gap-3">
        <Field label="USD settled" htmlFor="usd" error={moneyError(usd)}><MoneyInput id="usd" value={usd} onChange={(e) => setUsd(e.target.value)} /></Field>
        <Field label="HKD cash" htmlFor="hkd" error={moneyError(hkd)}><MoneyInput id="hkd" value={hkd} onChange={(e) => setHkd(e.target.value)} /></Field>
        <Field label="Options level" htmlFor="lv">
          <Select id="lv" value={level} onChange={(e) => setLevel(e.target.value)}>{[0, 1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</Select>
        </Field>
        <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>Save snapshot</Button>
        <Err error={save.error} />
      </CardBody>
    </Card>
  );
}

function RateForm({ current }: { current: { rate: string; as_of: string; source_url: string; kind: string } | null }) {
  const [kind, setKind] = useState(current?.kind ?? "tbill_13w");
  const [rate, setRate] = useState(current?.rate ?? "0.0378");
  const [asOf, setAsOf] = useState(current?.as_of ?? new Date().toISOString().slice(0, 10));
  const [url, setUrl] = useState(current?.source_url ?? "https://home.treasury.gov/resource-center/data-chart-center/interest-rates");
  const save = useIntent((_: void, key) => unwrap(api.inputs.rates.$post({ json: { kind: kind as "tbill_13w", rate, as_of: asOf, source_url: url } }, idem(key))),
    { invalidate: [...AFTER_WHEEL] });
  return (
    <Card>
      <CardHeader title="Rate" eyebrow="https source required" />
      <CardBody className="flex flex-col gap-3">
        <Field label="Kind" htmlFor="rk">
          <Select id="rk" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="tbill_13w">13-week T-bill</option>
            <option value="tbill_4w">4-week T-bill</option>
            <option value="idle_cash">Idle USD</option>
            <option value="sgov_sec">SGOV</option>
          </Select>
        </Field>
        <Field label="Rate (decimal)" htmlFor="rate" hint="0.0378 means 3.78 %"><TextInput id="rate" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
        <Field label="As of" htmlFor="asof"><TextInput id="asof" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></Field>
        <Field label="Source URL" htmlFor="url"><TextInput id="url" value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
        <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>Cite rate</Button>
        <Err error={save.error} />
      </CardBody>
    </Card>
  );
}

function ChainForm({ spot }: { spot: string }) {
  const [px, setPx] = useState(spot);
  const [exDiv, setExDiv] = useState("");
  const [csv, setCsv] = useState("P,2026-11-20,650,12.40,12.80\nP,2026-11-20,620,6.10,6.40\nC,2026-11-20,720,14.00,14.50");
  const save = useIntent((_: void, key) => {
    const quotes = csv.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
      const [put_call, expiry, strike, bid, ask, ns] = line.split(",").map((s) => s.trim());
      return { put_call: put_call as "P" | "C", expiry: expiry!, strike: strike!, bid: bid ? bid : null, ask: ask ? ask : null, non_standard: ns === "true" };
    });
    return unwrap(api.inputs["market-snapshots"].$post({ json: {
      spot: px, as_of: new Date().toISOString(), source: "manual", ex_dividend_date: exDiv || null, quotes,
    } }, idem(key)));
  }, { invalidate: [...AFTER_WHEEL] });
  return (
    <Card>
      <CardHeader title="Option chain" eyebrow="One row: P or C, expiry, strike, bid, ask" />
      <CardBody className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Spot" htmlFor="spot" error={moneyError(px, { positive: true })}><MoneyInput id="spot" value={px} onChange={(e) => setPx(e.target.value)} /></Field>
          <Field label="Ex-dividend (optional)" htmlFor="ex"><TextInput id="ex" value={exDiv} placeholder="YYYY-MM-DD" onChange={(e) => setExDiv(e.target.value)} /></Field>
        </div>
        <Field label="Quotes" htmlFor="csv" hint="Blank bid is stored as unpriced. A bid above the ask is rejected.">
          <textarea id="csv" className="num min-h-36 w-full rounded-control border border-control/50 bg-raised px-3 py-2 text-sm" value={csv} onChange={(e) => setCsv(e.target.value)} />
        </Field>
        <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>Save chain</Button>
        {save.error?.problem.errors && (
          <ul className="text-sm text-loss">{save.error.problem.errors.map((e) => <li key={e.pointer}>{e.pointer}: {e.message}</li>)}</ul>
        )}
        <Err error={save.error} />
      </CardBody>
    </Card>
  );
}
