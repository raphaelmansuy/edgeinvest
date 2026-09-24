import { FILL_CASH_PHRASE } from "@edge/contracts";
import { Button, Card, CardBody, Checkbox, ClaimLabel, FanChart, Field, Histogram, Select, Stat, TextInput, TypedConfirm, pct } from "@edge/ui";
import { useState } from "react";
import { Err, SIM_NAV, Screen } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { qk } from "../../lib/queries";
import { AttachResult } from "./attach";

export function MonteCarloScreen() {
  const [paths, setPaths] = useState("2000");
  const [quarters, setQuarters] = useState("20");
  const [seed, setSeed] = useState("20260828");
  const [sizing, setSizing] = useState<"willingness" | "fill_cash">("willingness");
  const [wheel, setWheel] = useState(false);
  const run = useIntent((confirm: string | undefined, key) => unwrap(api.sim.mc.$post({ json: {
    envelope_id: "beginner_v1", paths: Number(paths), quarters: Number(quarters), seed: Number(seed),
    max_contracts: 1, sizing_mode: sizing, fill_cash: sizing === "fill_cash", fill_cash_confirm: confirm,
    reserve_earns_rf: true, wheel,
  } }, idem(key))), { invalidate: [qk.results("mc")] });
  const s = run.data?.summary;

  return (
    <Screen scr="SCR-022" eyebrow="Simulate" title="Monte Carlo" nav={SIM_NAV}
      lead="Bootstrapped quarters. The chart is a range. There is no single expected number.">
      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Paths" htmlFor="paths"><TextInput id="paths" value={paths} onChange={(e) => setPaths(e.target.value)} /></Field>
          <Field label="Quarters" htmlFor="q"><TextInput id="q" value={quarters} onChange={(e) => setQuarters(e.target.value)} /></Field>
          <Field label="Seed" htmlFor="seed"><TextInput id="seed" value={seed} onChange={(e) => setSeed(e.target.value)} /></Field>
          <Field label="Sizing" htmlFor="sz">
            <Select id="sz" value={sizing} onChange={(e) => setSizing(e.target.value as "willingness" | "fill_cash")}>
              <option value="willingness">One lot (willingness)</option>
              <option value="fill_cash">Fill cash</option>
            </Select>
          </Field>
          <Checkbox label="Wheel after assignment" checked={wheel} onChange={(e) => setWheel(e.target.checked)} />
          <div className="sm:col-span-2">
            {sizing === "fill_cash"
              ? <TypedConfirm phrase={FILL_CASH_PHRASE} label="Run fill-cash" busy={run.isPending} onConfirm={() => run.mutate(FILL_CASH_PHRASE)} />
              : <Button variant="primary" disabled={run.isPending} onClick={() => run.mutate(undefined)}>Run</Button>}
          </div>
          <Err error={run.error} />
        </CardBody>
      </Card>
      {s && run.data && (
        <>
          <ClaimLabel label="sourced_sim">Model {run.data.model_version} · dataset {run.data.dataset} · {run.data.ms} ms · rate {run.data.rf.cited ? "cited" : "default, not cited"}.</ClaimLabel>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="CAGR p05" tone="loss"><span className="num">{pct(s.cagr_p05)}</span></Stat>
            <Stat label="CAGR p50"><span className="num">{pct(s.cagr_p50)}</span></Stat>
            <Stat label="CAGR p95" tone="ok"><span className="num">{pct(s.cagr_p95)}</span></Stat>
            <Stat label="P(end < start)"><span className="num">{pct(s.p_below_start)}</span></Stat>
          </div>
          <FanChart fan={s.fan} start={Number(run.data.params.startCash)} />
          <Histogram bins={s.histogram} marker={Number(run.data.params.startCash)} />
          <AttachResult kind="mc" resultId={run.data.result_id} />
        </>
      )}
    </Screen>
  );
}
