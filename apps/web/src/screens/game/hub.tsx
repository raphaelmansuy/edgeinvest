import { Badge, Button, Card, CardBody, CardHeader, EmptyArt, EmptyState, MasteryMeter } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LEARN_NAV, Screen, Stamp } from "../../components/kit";
import { catalogQuery, gamesQuery, masteryQuery } from "../../lib/queries";

export function GameHubScreen() {
  const cat = useSuspenseQuery(catalogQuery()).data;
  const games = useSuspenseQuery(gamesQuery()).data;
  const mastery = useSuspenseQuery(masteryQuery()).data;
  return (
    <Screen scr="SCR-007" eyebrow="Serious game" title="Practice the decision, not a score" nav={LEARN_NAV}
      lead="The paper lab uses the same rules as a real draft and never writes a cycle or a ledger line.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {mastery.competencies.map((c) => <MasteryMeter key={c.id} label={c.id.replaceAll("_", " ")} status={c.status} progress={c.progress} />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ModeCard title="Tutorial" body="Read one ticket out loud: bid, side, preview." to="/learn/game/tutorial" />
        {cat.scenarios.filter((s) => s.mode === "scenario").map((s) => (
          <ModeCard key={s.id} title={s.title} body={s.narrative} to={`/learn/game/scenario/${s.id}`} />
        ))}
        {cat.scenarios.filter((s) => s.mode === "paper_lab").map((s) => (
          <ModeCard key={s.id} title={s.title} body={s.narrative} to={`/learn/game/scenario/${s.id}`} />
        ))}
        {cat.crashes.map((s) => (
          <ModeCard key={s.id} title={s.title} body={s.narrative} to={`/learn/game/crash/${s.id}`} />
        ))}
        <ModeCard title="Monthly committee" body="Build the packet, write the premortem, then sell, skip or wait." to="/learn/game/committee" />
        <ModeCard title="After assignment" body="You own the shares. Choose a call at or above basis, or keep them." to="/learn/game/post-assign" />
      </div>
      <Card>
        <CardHeader title="Your attempts" />
        <CardBody>
          {games.length === 0 ? (
            <EmptyState art={<EmptyArt kind="chart" />} title="No attempt yet" teach="Start with the tutorial. It takes one ticket and no capital." />
          ) : (
            <ul className="divide-y divide-hair text-sm">
              {games.map((g) => (
                <li key={g.attempt_id} className="flex items-center justify-between py-2">
                  <span>{g.mode} · {g.scenario_id}</span>
                  <span className="flex items-center gap-2 text-muted">
                    {g.finished_at ? <Badge tone="ok">{g.process_score ?? "done"}</Badge> : <Badge>in progress</Badge>}
                    <Stamp at={g.started_at} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </Screen>
  );
}

function ModeCard({ title, body, to }: { title: string; body: string; to: string }) {
  return (
    <Card>
      <CardBody className="flex h-full flex-col gap-3">
        <h2 className="font-semibold text-ink">{title}</h2>
        <p className="flex-1 text-sm text-muted">{body}</p>
        <Link to={to as "/"}><Button size="sm" variant="primary">Start</Button></Link>
      </CardBody>
    </Card>
  );
}
