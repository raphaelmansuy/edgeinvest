import type { ScrId } from "@edge/contracts";
import type { GameMode } from "@edge/content/game";
import { Badge, Button, Card, CardBody, Field, LineChart, MoneyInput, RadioCard, TextInput } from "@edge/ui";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Err, LEARN_NAV, Screen } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { gameQuery, qk } from "../../lib/queries";
import type { GamePayload } from "../../lib/shapes";

export function GameScreen({ mode, scenarioId, scr }: { mode: GameMode; scenarioId?: string; scr: ScrId }) {
  const search = useSearch({ strict: false }) as { attempt?: string };
  const navigate = useNavigate();
  const id = search.attempt;
  const existing = useQuery({ ...gameQuery(id ?? "none"), enabled: Boolean(id) });
  const start = useIntent(async (scenario: string, key) => {
    const row = await unwrap(api.game.attempts.$post({ json: { mode, scenario_id: scenario }, }, idem(key))) as GamePayload;
    await navigate({ to: ".", search: { attempt: row.attempt_id } });
    return row;
  }, { invalidate: [qk.games] });
  const view = (existing.data as GamePayload | undefined)?.view ?? start.data?.view;
  const attemptId = id ?? start.data?.attempt_id;

  return (
    <Screen scr={scr} eyebrow="Game" title={view?.title ?? "Loading the brief"} lead={view?.narrative} nav={LEARN_NAV}>
      {!attemptId && (
        <Card>
          <CardBody>
            <p className="mb-3 text-sm text-muted">A new seed. Decisions are replayed, so refreshing does not change the path.</p>
            <Button variant="primary" disabled={start.isPending || !scenarioId} onClick={() => scenarioId && start.mutate(scenarioId)}>Begin</Button>
            <Err error={start.error} />
          </CardBody>
        </Card>
      )}
      {view && attemptId && <Play view={view} attemptId={attemptId} />}
    </Screen>
  );
}

function Play({ view, attemptId }: { view: GamePayload["view"]; attemptId: string }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const step = useIntent(
    (decision: Record<string, string>, key) => unwrap(api.game.attempts[":id"].$patch({ param: { id: attemptId }, json: { decision, finish: false } }, idem(key))) as Promise<GamePayload>,
    { invalidate: [qk.game(attemptId), qk.games, qk.mastery] },
  );
  const shown = step.data?.view ?? view;
  const path = shown.path;
  const revealed = path ? path.dates.slice(0, Math.max(1, path.revealed)) : [];

  return (
    <div className="flex flex-col gap-5">
      {path && revealed.length > 1 && (
        <LineChart dates={revealed} caption="Spot path revealed so far" summary={`${revealed.length} marks. The strike is drawn when you have chosen one.`}
          yLabel="QQQ" baseline={path.strike}
          markers={(path.marks ?? []).filter((m) => m.week < revealed.length).map((m) => ({ i: m.week, label: m.label }))}
          series={[{ key: "spot", label: "QQQ", values: path.spot.slice(0, revealed.length), tone: "accent" }]} />
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatLike label="Spot" value={shown.brief.spot.toFixed(2)} />
        <StatLike label="Envelope" value={shown.brief.envelope} />
        <StatLike label="Wheel" value={shown.wheel} />
      </div>
      {shown.feedback.length > 0 && (
        <ul className="flex flex-col gap-2">
          {shown.feedback.slice(-3).map((f, i) => (
            <li key={i} className={f.tone === "ok" ? "rounded-control border border-ok/30 bg-ok/8 px-3 py-2 text-sm" : f.tone === "loss" ? "rounded-control border border-loss/30 bg-loss/8 px-3 py-2 text-sm" : "rounded-control border border-hair bg-surface px-3 py-2 text-sm"}>{f.text}</li>
          ))}
        </ul>
      )}
      {shown.finished && shown.rubric && (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <p className="text-lg font-semibold text-ink">Process score {shown.rubric.score}</p>
            <p className="text-sm text-muted">{shown.rubric.pnlNote}</p>
            <ul className="divide-y divide-hair text-sm">
              {shown.rubric.items.map((it) => (
                <li key={it.id} className="flex justify-between gap-3 py-2">
                  <span>{it.label}<span className="block text-xs text-muted">{it.note}</span></span>
                  <Badge tone={it.earned > 0 ? "ok" : "loss"}>{it.earned}/{it.weight}</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
      {shown.prompt && !shown.finished && (
        <Card>
          <CardBody className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-accent uppercase">{shown.prompt.stage}</p>
              <h2 className="mt-1 text-lg font-semibold text-ink">{shown.prompt.title}</h2>
              <p className="mt-1 text-sm text-muted">{shown.prompt.body}</p>
            </div>
            {shown.prompt.fields.filter((f) => !f.showIf || f.showIf.equals.includes(draft[f.showIf.field] ?? "")).map((f) => (
              <Field key={f.name} label={f.label} htmlFor={f.name} hint={f.hint}>
                {f.kind === "radio" || f.kind === "cards" ? (
                  <div className="grid gap-2">{(f.options ?? []).map((o) => (
                    <RadioCard key={o.value} name={f.name} value={o.value} title={o.label} meta={o.meta} checked={draft[f.name] === o.value}
                      onChange={() => setDraft({ ...draft, [f.name]: o.value })} />
                  ))}</div>
                ) : f.kind === "money" ? (
                  <MoneyInput id={f.name} value={draft[f.name] ?? ""} onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value })} />
                ) : f.kind === "textarea" ? (
                  <textarea id={f.name} className="min-h-24 rounded-control border border-control/50 bg-raised px-3 py-2 text-sm" value={draft[f.name] ?? ""}
                    onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value })} />
                ) : (
                  <TextInput id={f.name} value={draft[f.name] ?? ""} onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value })} />
                )}
              </Field>
            ))}
            <Button variant="primary" disabled={step.isPending} onClick={() => { step.mutate(draft); setDraft({}); }}>{shown.prompt.cta}</Button>
            <Err error={step.error} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function StatLike({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-hair bg-raised px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="num mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}
