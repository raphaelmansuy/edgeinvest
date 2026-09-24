import { LIVE_PHRASE } from "@edge/contracts";
import { Button, Card, CardBody, TypedConfirm } from "@edge/ui";
import { Err, ME_NAV, Screen } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { useCaps } from "../../lib/screen";

export function ModeScreen() {
  const caps = useCaps();
  const setMode = useIntent((v: { mode: "paper" | "live"; phrase?: string }, key) => unwrap(api.me.mode.$patch({ json: { mode: v.mode, confirm_phrase: v.phrase } }, idem(key))),
    { caps: true });
  return (
    <Screen scr="SCR-072" eyebrow="Me" title="Paper or live" nav={ME_NAV}
      lead="Paper is the default. Live uses the account you type into IBKR. The rules do not relax.">
      <Card>
        <CardBody className="flex flex-col gap-3">
          <p className="text-sm">Current mode: <span className="font-semibold">{caps.mode}</span></p>
          {caps.mode === "live"
            ? <Button variant="secondary" disabled={setMode.isPending} onClick={() => setMode.mutate({ mode: "paper" })}>Return to paper</Button>
            : caps.live_eligible
              ? <TypedConfirm phrase={LIVE_PHRASE} label="Enable live" variant="primary" busy={setMode.isPending} onConfirm={() => setMode.mutate({ mode: "live", phrase: LIVE_PHRASE })} />
              : (
                <div>
                  <p className="text-sm font-medium text-ink">Live is locked</p>
                  <ul className="mt-2 list-disc pl-5 text-sm text-muted">{caps.live_blockers.map((b) => <li key={b}>{b}</li>)}</ul>
                </div>
              )}
          <Err error={setMode.error} />
        </CardBody>
      </Card>
    </Screen>
  );
}
