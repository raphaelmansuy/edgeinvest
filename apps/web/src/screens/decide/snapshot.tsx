import { AsOfStamp, Button, Card, CardBody, MoneyText, Pct, Stat } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { DECIDE_NAV, Err, Screen } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { AFTER_WHEEL, inputsQuery } from "../../lib/queries";
import { useCaps } from "../../lib/screen";

export function SnapshotScreen() {
  const caps = useCaps();
  const inputs = useSuspenseQuery(inputsQuery()).data;
  const navigate = useNavigate();
  const phase = caps.phase === "shares-held" ? "shares-held" : "cash-put";
  const create = useIntent(async (_: void, key) => {
    const row = await unwrap(api.memos.$post({ json: { phase } }, idem(key)));
    await navigate({ to: phase === "shares-held" ? "/decide/call-candidates" : "/decide/candidates", search: { candidate: undefined } });
    return row;
  }, { invalidate: [...AFTER_WHEEL] });

  return (
    <Screen scr="SCR-030" eyebrow="Decide" title="This month's snapshot" nav={DECIDE_NAV}
      lead="The memo pins these three inputs. If any is missing, scoring refuses."
      actions={<Button variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>Build memo</Button>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardBody>
          <Stat label="Settled USD"><MoneyText value={inputs.account?.usd_settled_cash} /></Stat>
          <p className="mt-2 text-xs text-muted">HKD <MoneyText value={inputs.account?.hkd_cash} /> · level {inputs.account?.options_level ?? "—"} · {inputs.account?.fx_loan_flag ? "FX loan" : "no FX loan"}</p>
          <AsOfStamp at={inputs.account?.as_of} />
        </CardBody></Card>
        <Card><CardBody>
          <Stat label="QQQ spot"><MoneyText value={inputs.market?.spot} /></Stat>
          <p className="mt-2 text-xs text-muted">{inputs.market?.quotes.length ?? 0} quotes · {inputs.market?.source ?? "none"}</p>
          <AsOfStamp at={inputs.market?.as_of} />
        </CardBody></Card>
        <Card><CardBody>
          <Stat label="Cited rate"><Pct value={inputs.rate?.rate} /></Stat>
          <p className="mt-2 text-xs text-muted">{inputs.rate?.kind ?? "no rate"} · {inputs.rate?.as_of ?? ""}</p>
        </CardBody></Card>
      </div>
      <Err error={create.error} />
    </Screen>
  );
}
