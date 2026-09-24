import { Button, Card, CardBody, Checkbox, ClaimLabel, Field, LineChart, TextInput } from "@edge/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Err, SIM_NAV, Screen, num } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { jobQuery } from "../../lib/queries";
import type { JobView } from "../../lib/shapes";

interface Bt {
  dates: string[]; wealth: number[]; fully_secured: number[]; buy_hold: number[]; tbill: number[];
  metrics: { cagr: number; max_dd: number; bh_cagr: number; tbill_cagr: number; cycles: number; assignment_rate: number };
}

export function BacktestScreen() {
  const [start, setStart] = useState("2010-01-01");
  const [end, setEnd] = useState("2026-08-31");
  const [cash, setCash] = useState("100000");
  const [wheel, setWheel] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const queue = useIntent(async (_: void, key) => {
    const row = await unwrap(api.sim.backtest.$post({ json: { envelope_id: "beginner_v1", start, end, start_cash: cash, wheel } }, idem(key)));
    setJobId(row.job_id);
    return row;
  });
  const job = useQuery({
    ...jobQuery(jobId ?? "none"),
    enabled: Boolean(jobId),
    refetchInterval: (q) => {
      const s = (q.state.data as JobView | undefined)?.status;
      return s === "queued" || s === "running" || s === "processing" ? 1000 : false;
    },
  });
  const summary = job.data?.summary as Bt | null | undefined;
  const progress = Number(job.data?.progress ?? 0);

  return (
    <Screen scr="SCR-023" eyebrow="Simulate" title="Backtest" nav={SIM_NAV}
      lead="Quarterly decisions on monthly history. Premium is a Black-Scholes proxy, so the claim stays unconfirmed. The job runs in the worker.">
      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Start" htmlFor="st"><TextInput id="st" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="End" htmlFor="en"><TextInput id="en" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          <Field label="Start cash" htmlFor="cash"><TextInput id="cash" value={cash} onChange={(e) => setCash(e.target.value)} /></Field>
          <Checkbox label="Wheel" checked={wheel} onChange={(e) => setWheel(e.target.checked)} />
          <Button variant="primary" disabled={queue.isPending} onClick={() => queue.mutate()}>Queue backtest</Button>
          <Err error={queue.error} />
        </CardBody>
      </Card>
      {job.data && (
        <Card>
          <CardBody className="flex flex-col gap-2">
            <p className="text-sm font-medium text-ink">Job {job.data.status}{job.data.error ? ` · ${job.data.error}` : ""}</p>
            <div className="h-2 overflow-hidden rounded-full bg-hair" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} role="progressbar">
              <div className="h-full bg-accent transition-all" style={{ width: `${Math.min(100, progress * 100)}%` }} />
            </div>
          </CardBody>
        </Card>
      )}
      {summary?.dates && (
        <>
          <ClaimLabel label="unconfirmed">Premium is a model, not a fill. CAGR {num(summary.metrics.cagr * 100, 1)} % · max drawdown {num(summary.metrics.max_dd * 100, 1)} % · {summary.metrics.cycles} cycles.</ClaimLabel>
          <LineChart dates={summary.dates} caption="Backtest wealth" yLabel="Wealth (USD)"
            summary={`Buy and hold CAGR ${num(summary.metrics.bh_cagr * 100, 1)} %. T-bill CAGR ${num(summary.metrics.tbill_cagr * 100, 1)} %. Assignment rate ${num(summary.metrics.assignment_rate * 100, 1)} %.`}
            series={[
              { key: "csp", label: "CSP wheel", values: summary.wealth, tone: "accent" },
              { key: "bh", label: "Buy & hold", values: summary.buy_hold, tone: "ink", dashed: true },
              { key: "tb", label: "T-bill", values: summary.tbill, tone: "muted" },
              { key: "fs", label: "Fully secured", values: summary.fully_secured, tone: "caution", dashed: true },
            ]} />
        </>
      )}
    </Screen>
  );
}
