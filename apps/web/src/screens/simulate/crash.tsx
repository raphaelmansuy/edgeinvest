import { FILL_CASH_PHRASE } from "@edge/contracts";
import type { CrashResult } from "@edge/sim";
import { Button, Card, CardBody, Checkbox, ClaimLabel, Field, LineChart, Select, TypedConfirm } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Err, SIM_NAV, Screen, num } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { qk, scenariosQuery } from "../../lib/queries";
import { AttachResult } from "./attach";

const TONE = { tbill: "muted", buy_hold: "ink", csp_one_lot: "accent", csp_fill_cash: "loss" } as const;

export function CrashScreen() {
  const scenarios = useSuspenseQuery(scenariosQuery()).data;
  const [scenario, setScenario] = useState(scenarios.crashes[0]?.id ?? "gfc_2008");
  const [fill, setFill] = useState(false);
  const [wheel, setWheel] = useState(true);
  const [scale, setScale] = useState(true);
  const run = useIntent((confirm: string | undefined, key) => unwrap(api.sim.crash.$post({ json: {
    scenario_id: scenario, envelope_id: "beginner_v1", max_contracts: 1, fill_cash: fill, fill_cash_confirm: confirm,
    wheel, reserve_earns_rf: true, scale_to_spot: scale,
  } }, idem(key))), { invalidate: [qk.results("crash")] });
  const result = run.data?.result as CrashResult | undefined;

  return (
    <Screen scr="SCR-021" eyebrow="Simulate" title="Crash replay" nav={SIM_NAV}
      lead="One historical path, replayed with the same envelope rules. Fill-cash is shown only after you type the phrase, because it adds lots into a falling market.">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <Field label="Scenario" htmlFor="sc">
            <Select id="sc" value={scenario} onChange={(e) => setScenario(e.target.value)}>
              {scenarios.crashes.map((s) => <option key={s.id} value={s.id}>{s.title} ({s.start} → {s.end})</option>)}
            </Select>
          </Field>
          <Checkbox label="Scale the path to your latest spot" checked={scale} onChange={(e) => setScale(e.target.checked)} />
          <Checkbox label="Wheel: sell a call after assignment" checked={wheel} onChange={(e) => setWheel(e.target.checked)} />
          <Checkbox label="Fill cash (extra lots)" checked={fill} onChange={(e) => setFill(e.target.checked)} />
          {fill
            ? <TypedConfirm phrase={FILL_CASH_PHRASE} label="Run fill-cash" busy={run.isPending} onConfirm={() => run.mutate(FILL_CASH_PHRASE)} />
            : <Button variant="primary" disabled={run.isPending} onClick={() => run.mutate(undefined)}>Replay</Button>}
          <Err error={run.error} />
        </CardBody>
      </Card>
      {result && run.data && (
        <>
          <ClaimLabel label="sourced_sim">Model {run.data.model_version}. Spot source: {run.data.spot_source.source}.</ClaimLabel>
          <LineChart dates={result.dates} caption={result.scenario.title} yLabel="Wealth (USD)"
            summary={`Assigned: ${result.assigned ? result.assigned.date : "never"}. Weeks under water: ${result.weeks_under_water}.`}
            markers={result.events.filter((e) => e.kind === "assigned" || e.kind === "called_away").map((e) => ({ i: e.week, label: e.kind }))}
            series={result.paths.map((p) => ({ key: p.key, label: p.label, values: p.wealth, tone: TONE[p.key], dashed: p.key === "csp_fill_cash" }))} />
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.entries(result.summary) as [string, { end: number; max_dd: number }][]).map(([k, v]) => (
              <Card key={k}><CardBody><p className="text-xs uppercase text-muted">{k}</p><p className="num font-semibold">end {num(v.end, 0)} · max dd {num(v.max_dd * 100, 1)} %</p></CardBody></Card>
            ))}
          </div>
          <AttachResult kind="crash" resultId={run.data.result_id} />
        </>
      )}
    </Screen>
  );
}
