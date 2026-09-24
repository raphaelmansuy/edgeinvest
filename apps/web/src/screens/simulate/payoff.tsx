import { Button, Card, CardBody, Field, MoneyInput, PayoffChart, Select, TicketThreeNumbers, moneyError } from "@edge/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SIM_NAV, Screen } from "../../components/kit";
import { api, unwrap } from "../../lib/api";

export function PayoffScreen() {
  const [putCall, setPutCall] = useState<"P" | "C">("P");
  const [strike, setStrike] = useState("650");
  const [premium, setPremium] = useState("12.40");
  const [spot, setSpot] = useState("721");
  const [basis, setBasis] = useState("637.60");
  const [debounced, setDebounced] = useState({ putCall, strike, premium, spot, basis });
  useEffect(() => {
    const t = setTimeout(() => setDebounced({ putCall, strike, premium, spot, basis }), 250);
    return () => clearTimeout(t);
  }, [putCall, strike, premium, spot, basis]);
  const errs = {
    strike: moneyError(strike, { positive: true }),
    premium: moneyError(premium, { positive: true }),
    spot: moneyError(spot, { positive: true }),
    basis: putCall === "C" ? moneyError(basis, { positive: true }) : null,
  };
  const ready = !errs.strike && !errs.premium && !errs.spot && !errs.basis;
  const q = useQuery({
    queryKey: ["sim", "payoff", debounced],
    enabled: ready,
    queryFn: () => unwrap(api.sim.payoff.$post({ json: {
      put_call: debounced.putCall, strike: debounced.strike, premium: debounced.premium, qty: 1, spot: debounced.spot,
      ...(debounced.putCall === "C" ? { cost_basis: debounced.basis } : {}),
    } })),
  });
  const data = q.data;

  return (
    <Screen scr="SCR-020" eyebrow="Simulate" title="Payoff at expiry" nav={SIM_NAV}
      lead="The flat line is the premium you keep. The slope below the strike is the loss, drawn through zero so the worst case is visible.">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardBody className="flex flex-col gap-3">
            <Field label="Contract" htmlFor="pc">
              <Select id="pc" value={putCall} onChange={(e) => setPutCall(e.target.value as "P" | "C")}>
                <option value="P">Cash-secured put</option>
                <option value="C">Covered call</option>
              </Select>
            </Field>
            <Field label="Strike" htmlFor="k" error={errs.strike}><MoneyInput id="k" value={strike} invalid={!!errs.strike} onChange={(e) => setStrike(e.target.value)} /></Field>
            <Field label="Premium" htmlFor="p" error={errs.premium}><MoneyInput id="p" value={premium} invalid={!!errs.premium} onChange={(e) => setPremium(e.target.value)} /></Field>
            <Field label="Spot" htmlFor="s" error={errs.spot}><MoneyInput id="s" value={spot} invalid={!!errs.spot} onChange={(e) => setSpot(e.target.value)} /></Field>
            {putCall === "C" && <Field label="Decision basis" htmlFor="b" error={errs.basis}><MoneyInput id="b" value={basis} invalid={!!errs.basis} onChange={(e) => setBasis(e.target.value)} /></Field>}
            <Button variant="secondary" onClick={() => setDebounced({ putCall, strike, premium, spot, basis })}>Redraw</Button>
          </CardBody>
        </Card>
        <div className="flex flex-col gap-4">
          {data && (
            <>
              <TicketThreeNumbers qty={1} inv={data.invariants.kind === "put"
                ? { kind: "put", reserve: data.invariants.reserve, maxProfit: data.invariants.max_profit, breakEven: data.invariants.break_even, worstCase: data.invariants.worst_case }
                : { kind: "call", sharesCovered: data.invariants.shares_covered, creditOnly: data.invariants.credit, maxProfit: data.invariants.max_profit, worstCase: data.invariants.worst_case, lockedLoss: data.invariants.locked_loss, basis }} />
              <PayoffChart points={data.points} strike={Number(strike)} breakEven={data.break_even} spot={Number(spot)} basis={putCall === "C" ? Number(basis) : undefined} />
            </>
          )}
        </div>
      </div>
    </Screen>
  );
}
