import { Badge, Button, Card, CardBody, Field, RadioCard, TextInput } from "@edge/ui";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Err, LEARN_NAV, Screen, Stamp } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { curriculumQuery, qk, quizQuery } from "../../lib/queries";

const QUIZ_MODULES = ["M1", "M2", "M3", "M4", "M5", "M7"];

export function QuizScreen({ module }: { module: string }) {
  const quiz = useSuspenseQuery(quizQuery(module)).data;
  const mods = useSuspenseQuery(curriculumQuery()).data;
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const open = useIntent((tag: string, key) => unwrap(api.quiz.attempts[":id"].remediation[":tag"].$post({ param: { id: quiz.last_attempt_id ?? "", tag } }, idem(key))),
    { invalidate: [qk.quiz(module)] });
  const submit = useIntent((_: void, key) => unwrap(api.quiz[":module"].attempts.$post({ param: { module }, json: { seed: quiz.seed, answers } }, idem(key))),
    { invalidate: [qk.quiz(module), qk.mastery], caps: true });
  const blocked = quiz.remediation_required.length > 0;

  return (
    <Screen scr="SCR-006" eyebrow={module} title={quiz.title} nav={LEARN_NAV}
      lead={`Pass mark ${(quiz.pass_threshold * 100).toFixed(0)} %. A miss opens a remediation card before you can retry.`}>
      <div className="flex flex-wrap gap-2">
        {QUIZ_MODULES.map((m) => {
          const meta = mods.find((x) => x.code === m);
          return (
            <Link key={m} to="/learn/quizzes/$module" params={{ module: m }}
              className={m === module ? "rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-ink" : "rounded-full bg-surface px-3 py-1 text-sm font-medium text-muted"}>
              {m}{meta ? ` ${meta.title}` : ""}
            </Link>
          );
        })}
      </div>

      {blocked && (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <p className="font-medium text-ink">Open each card before the next attempt.</p>
            {quiz.remediation_required.map((r) => (
              <div key={r.id} className="rounded-control border border-caution/30 bg-caution/8 p-3">
                <p className="text-sm font-semibold text-ink">{r.id} · {r.misconception}</p>
                <p className="mt-1 text-sm text-ink/85">{r.card}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="secondary" disabled={open.isPending} onClick={() => open.mutate(r.id)}>I have read this</Button>
                  <Link to={r.to as "/"} className="text-sm font-medium text-accent hover:underline">Re-read</Link>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {quiz.items.map((it, n) => (
          <Card key={it.id}>
            <CardBody className="flex flex-col gap-3">
              <p className="text-sm font-medium text-ink"><span className="num text-muted">{n + 1}.</span> {it.prompt}</p>
              {it.kind === "choice" ? (
                <div className="grid gap-2">{(it.choices ?? []).map((c) => (
                  <RadioCard key={c} name={it.id} value={c} title={c} checked={answers[it.id] === c} disabled={blocked} onChange={() => setAnswers({ ...answers, [it.id]: c })} />
                ))}</div>
              ) : (
                <Field label={it.unit ?? "Answer"} htmlFor={it.id}>
                  <TextInput id={it.id} value={answers[it.id] ?? ""} disabled={blocked} onChange={(e) => setAnswers({ ...answers, [it.id]: e.target.value })} />
                </Field>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button variant="primary" disabled={blocked || submit.isPending} onClick={() => submit.mutate()}>Submit quiz</Button>
        {submit.data && <Badge tone={submit.data.passed ? "ok" : "loss"}>{Math.round(submit.data.score * 100)} % · {submit.data.passed ? "passed" : "not yet"}</Badge>}
      </div>
      {submit.data && !submit.data.passed && (
        <Card>
          <CardBody className="flex flex-col gap-2 text-sm">
            {submit.data.remediation.map((r: { id: string; card: string }) => <p key={r.id}><span className="font-semibold">{r.id}.</span> {r.card}</p>)}
            <Button size="sm" variant="secondary" onClick={() => { submit.reset(); void qc.invalidateQueries({ queryKey: qk.quiz(module) }); }}>Load the cards and a new seed</Button>
          </CardBody>
        </Card>
      )}
      <Err error={submit.error ?? open.error} />
      {quiz.attempts.length > 0 && (
        <Card>
          <CardBody>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Earlier attempts</p>
            <ul className="space-y-1 text-sm">{quiz.attempts.map((a) => (
              <li key={a.attempt_id} className="flex justify-between"><span className={a.passed ? "text-ok" : "text-muted"}>{a.passed ? "passed" : "missed"} · {Number(a.score_pct).toFixed(0)} %</span><Stamp at={a.created_at} /></li>
            ))}</ul>
          </CardBody>
        </Card>
      )}
    </Screen>
  );
}
