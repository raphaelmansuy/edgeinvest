import { Button, Card, CardBody, Field, MoneyInput, PayoffChart, YieldStack, moneyError } from "@edge/ui";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Err, LEARN_NAV, Screen } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { qk, ticketQuery } from "../../lib/queries";

const FIELDS = [
  ["reserve", "Reserve (USD)"],
  ["max_profit", "Max profit (USD)"],
  ["break_even", "Break-even (per share)"],
  ["worst_case", "Worst case (USD)"],
] as const;

export function ArithmeticScreen() {
  const ticket = useSuspenseQuery(ticketQuery()).data;
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({ reserve: "", max_profit: "", break_even: "", worst_case: "" });
  const payoff = useQuery({
    queryKey: ["learn", "payoff", ticket.seed],
    queryFn: () => unwrap(api.sim.payoff.$post({ json: {
      put_call: "P", strike: ticket.strike.toFixed(2), premium: ticket.premium.toFixed(2), qty: 1, spot: "650",
    } })),
  });
  const submit = useIntent(
    (_: void, key) => unwrap(api.learn.tickets.$post({ json: { seed: ticket.seed, answers } }, idem(key))),
    { invalidate: [qk.mastery] },
  );
  const chart = payoff.data;

  return (
    <Screen scr="SCR-004" eyebrow="M3" title="Cash-secured put arithmetic" nav={LEARN_NAV}
      lead="Four numbers, exact to the cent, before any preview. Three distinct tickets unlock the arithmetic meter.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <p className="rounded-control bg-surface px-4 py-3 font-medium text-ink">{ticket.text}</p>
            <p className="text-sm text-muted">One contract is 100 shares. Premium {ticket.premium.toFixed(2)} is per share.</p>
            {FIELDS.map(([k, label]) => {
              const err = answers[k] ? moneyError(answers[k]!, { positive: k !== "worst_case" }) : null;
              return (
                <Field key={k} label={label} htmlFor={k} error={err}>
                  <MoneyInput id={k} value={answers[k] ?? ""} invalid={!!err} onChange={(e) => setAnswers({ ...answers, [k]: e.target.value })} />
                </Field>
              );
            })}
            <Button variant="primary" disabled={submit.isPending} onClick={() => submit.mutate()}>Check this ticket</Button>
            <Err error={submit.error} />
            {submit.data && (
              <div className="text-sm">
                <p className="font-medium text-ink">{submit.data.passed ? "All four exact." : "Not yet. The expected values are shown so you can see the gap."}</p>
                <ul className="mt-2 space-y-1">
                  {submit.data.results.map((r: { field: string; ok: boolean; want: string }) => (
                    <li key={r.field} className={r.ok ? "text-ok" : "text-loss"}>{r.field.replaceAll("_", " ")} · expected {r.want}</li>
                  ))}
                </ul>
                <p className="mt-2 text-muted">{submit.data.distinct_passed} of {submit.data.needed} distinct passes.</p>
                <Button className="mt-3" variant="secondary" onClick={() => { setAnswers({ reserve: "", max_profit: "", break_even: "", worst_case: "" }); submit.reset(); void qc.invalidateQueries({ queryKey: qk.ticket }); }}>Another ticket</Button>
              </div>
            )}
          </CardBody>
        </Card>
        <div className="flex flex-col gap-4">
          {chart && (
            <PayoffChart points={chart.points} strike={ticket.strike} breakEven={chart.break_even} spot={650}
              label="Profit and loss at expiry for this ticket" />
          )}
          <YieldStack premiumYieldAnn={null} periodYield={null} dte={null} tbill={null} />
        </div>
      </div>
    </Screen>
  );
}
