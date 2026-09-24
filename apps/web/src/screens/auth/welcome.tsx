import { COPY_VERSION, DISCLOSURES, ONBOARDING_DISCLOSURES } from "@edge/copy";
import {
  Button, Card, CardBody, Checkbox, CopyText, Field, IconArrowLeft, IconArrowRight, IconCheck, MoneyInput, PageHeader, ProblemAlert, Select,
  WheelDiagram, cx, moneyError,
} from "@edge/ui";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { disclosuresQuery, meQuery, qk } from "../../lib/queries";

const STEPS = ["WHY", "Jurisdiction", "Disclosures", "Paper lab"] as const;
export const JURISDICTIONS = [
  ["HK", "Hong Kong"], ["SG", "Singapore"], ["GB", "United Kingdom"], ["US", "United States"], ["AU", "Australia"], ["CA", "Canada"], ["FR", "France"], ["DE", "Germany"],
] as const;

export function WelcomeScreen() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const me = useQuery(meQuery());
  const disc = useQuery(disclosuresQuery());
  const [jur, setJur] = useState<string | null>(null);
  const [cash, setCash] = useState<string | null>(null);
  const jurisdiction = jur ?? me.data?.jurisdiction ?? "HK";
  const startCash = cash ?? (me.data?.paper_start_cash ? String(Number(me.data.paper_start_cash)) : "100000");

  const saveJur = useIntent((_: void, key) => unwrap(api.me.$patch({ json: { jurisdiction } }, idem(key))),
    { invalidate: [qk.me, qk.disclosures], caps: true, onSuccess: () => setStep(2) });
  const ack = useIntent((k: string, key) => unwrap(api.me.disclosures[":key"].ack.$post({ param: { key: k }, json: { copy_version: COPY_VERSION, scr: "SCR-101" } }, idem(key))),
    { invalidate: [qk.disclosures] });
  const finish = useIntent((_: void, key) => unwrap(api.me.$patch({ json: { paper_start_cash: startCash } }, idem(key))),
    { invalidate: [qk.me], caps: true, onSuccess: () => navigate({ to: "/learn/why" }) });

  const acked = new Set((disc.data?.disclosures ?? []).filter((d: { acked_at: string | null }) => d.acked_at).map((d: { key: string }) => d.key));
  const jurChanged = me.data && me.data.jurisdiction !== jurisdiction;
  const allAcked = ONBOARDING_DISCLOSURES.every((k) => acked.has(k)) && !jurChanged;
  const cashErr = moneyError(startCash, { positive: true });
  const err = saveJur.error ?? ack.error ?? finish.error;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader scr="SCR-101" eyebrow="First run" title="Welcome to EdgeInvest"
        lead="Four short steps. Nothing here touches money; the lab uses a paper account." />
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}>
            <div className={cx("h-1.5 rounded-full transition-colors", i < step ? "bg-accent" : i === step ? "bg-accent/60" : "bg-hair")} />
            <p className={cx("mt-2 text-xs font-medium", i === step ? "text-ink" : "text-muted")}>
              <span className="num">Step {i + 1}</span> · {s}
            </p>
          </li>
        ))}
      </ol>

      <Card>
        <CardBody className="min-h-80 p-6 sm:p-8">
          {step === 0 && (
            <div className="grid items-center gap-8 sm:grid-cols-[1fr_240px]">
              <div>
                <p className="text-xs font-semibold tracking-wide text-accent uppercase">Why you are here</p>
                <blockquote className="mt-3 text-xl leading-relaxed font-medium text-ink">
                  “Before you sell a put you will be able to state reserve, max profit, break-even, assignment risk and worst case, in words.”
                </blockquote>
                <p className="mt-4 text-sm text-muted">
                  You learn first, then simulate, then write a decision memo. Only then can a draft exist, and you still place every order yourself in IBKR.
                </p>
              </div>
              <WheelDiagram size={240} />
            </div>
          )}

          {step === 1 && (
            <div className="flex max-w-md flex-col gap-5">
              <Field label="Where do you live for tax purposes?" htmlFor="jur" hint="The content is written for Hong Kong residents. Changing this later asks you to re-acknowledge the disclosures.">
                <Select id="jur" value={jurisdiction} onChange={(e) => setJur(e.target.value)}>
                  {JURISDICTIONS.map(([code, label]) => <option key={code} value={code}>{label} ({code})</option>)}
                </Select>
              </Field>
              {jurisdiction !== "HK" && (
                <p className="rounded-control border border-caution/35 bg-caution/8 px-3 py-2 text-sm">Content written for Hong Kong residents. Tax notes will not match your jurisdiction.</p>
              )}
              <div className="rounded-control border border-hair bg-surface px-4 py-3 text-sm">
                <p className="font-medium text-ink">Voice: personal book</p>
                <p className="mt-0.5 text-muted">EdgeInvest speaks to one person managing their own money, never to a fund or its clients.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">Read each one and tick it. Copy version <span className="num font-medium text-ink">{COPY_VERSION}</span>; a new version asks again.</p>
              {DISCLOSURES.filter((d) => ONBOARDING_DISCLOSURES.includes(d.key)).map((d) => (
                <details key={d.key} className="group rounded-card border border-hair bg-raised open:bg-surface/50" open={!acked.has(d.key)}>
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                    <span className={cx("flex size-6 items-center justify-center rounded-full", acked.has(d.key) ? "bg-ok text-white dark:text-bg" : "border border-control/60")}>
                      {acked.has(d.key) && <IconCheck size={14} />}
                    </span>
                    <span className="flex-1 font-medium text-ink">{d.title}</span>
                    <span className="text-xs text-accent group-open:hidden">read</span>
                  </summary>
                  <div className="px-4 pb-4 pl-13">
                    <p className="text-sm leading-relaxed text-ink/85"><CopyText text={d.body} /></p>
                    <Checkbox className="mt-3" label="I have read and understood this" checked={acked.has(d.key)} disabled={acked.has(d.key) || ack.isPending}
                      onChange={(e) => e.target.checked && ack.mutate(d.key)} data-ack={d.key} />
                  </div>
                </details>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="flex max-w-md flex-col gap-5">
              <Field label="Paper lab start cash" htmlFor="cash" unit="USD" error={cashErr}
                hint="The simulated account used by the game and paper cycles. It never mixes with real money.">
                <MoneyInput id="cash" value={startCash} onChange={(e) => setCash(e.target.value)} invalid={!!cashErr} />
              </Field>
              <p className="text-sm text-muted">One lot of a 650 put reserves <span className="num font-medium text-ink">65,000.00 USD</span>. Start cash below that means the lab can only teach, not trade a lot.</p>
            </div>
          )}

          {err && <div className="mt-6"><ProblemAlert problem={err.problem} /></div>}
        </CardBody>
        <footer className="flex items-center justify-between gap-3 border-t border-hair bg-surface/60 px-6 py-4">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} icon={<IconArrowLeft size={16} />}>Back</Button>
          {step === 0 && <Button variant="primary" onClick={() => setStep(1)}>Continue <IconArrowRight size={16} /></Button>}
          {step === 1 && <Button variant="primary" disabled={saveJur.isPending} onClick={() => (jurChanged || !me.data?.jurisdiction ? saveJur.mutate() : setStep(2))}>Save and continue <IconArrowRight size={16} /></Button>}
          {step === 2 && <Button variant="primary" disabled={!allAcked} onClick={() => setStep(3)}>Continue <IconArrowRight size={16} /></Button>}
          {step === 3 && <Button variant="primary" disabled={!!cashErr || finish.isPending || !allAcked} onClick={() => finish.mutate()} data-testid="start-why">Start with WHY <IconArrowRight size={16} /></Button>}
        </footer>
      </Card>
    </div>
  );
}
