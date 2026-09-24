import { Badge, Card, CardBody } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { JOURNAL_NAV, Screen, Stamp } from "../../components/kit";
import { lessonsQuery } from "../../lib/queries";

export function LessonsScreen() {
  const data = useSuspenseQuery(lessonsQuery()).data;
  return (
    <Screen scr="SCR-052" eyebrow="Journal" title="What you have practised" nav={JOURNAL_NAV}
      lead="Quizzes, finished games and recorded skips, newest first. A tag that keeps appearing is the thing to re-read.">
      {data.misconceptions.length > 0 && (
        <div className="flex flex-wrap gap-2">{data.misconceptions.map((t) => <Badge key={t.id ?? t.misconception} tone="caution">{t.id} × {t.count}</Badge>)}</div>
      )}
      <ul className="flex flex-col gap-2">
        {data.items.map((it) => (
          <li key={`${it.kind}-${it.id}`}>
            <Card><CardBody className="flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium text-ink">{it.kind} · {it.ref}</p>
                {it.note && <p className="text-muted">{it.note}</p>}
              </div>
              <span className="flex items-center gap-2 text-muted">
                {it.passed === true && <Badge tone="ok">passed</Badge>}
                {it.passed === false && <Badge tone="loss">missed</Badge>}
                <Stamp at={it.created_at} />
              </span>
            </CardBody></Card>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
