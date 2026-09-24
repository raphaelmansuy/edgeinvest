import { Badge, Button, Card, CardBody, RadioCard } from "@edge/ui";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Err, LEARN_NAV, Screen } from "../../components/kit";
import { api, idem, unwrap } from "../../lib/api";
import { useIntent } from "../../lib/mutation";
import { qk, vocabQuery } from "../../lib/queries";

export function SevenWordsScreen() {
  const run = useSuspenseQuery(vocabQuery()).data;
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [i, setI] = useState(0);
  const submit = useIntent(
    (_: void, key) => unwrap(api.learn.vocab.$post({ json: { seed: run.seed, answers } }, idem(key))),
    { invalidate: [qk.mastery], caps: true },
  );
  const card = run.cards[i];
  const done = Object.keys(answers).length === run.cards.length;

  return (
    <Screen scr="SCR-002" eyebrow="M1" title="Seven words" nav={LEARN_NAV}
      lead="Share, put, call, strike, premium, expiry, assignment. Say each one in your own words, then check it.">
      {!card ? null : (
        <Card>
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Word {i + 1} of {run.total}</p>
              <Badge tone="accent">{card.word}</Badge>
            </div>
            <p className="text-lg leading-relaxed text-ink">{card.definition}</p>
            <p className="text-sm font-medium text-ink">{card.check}</p>
            <div className="grid gap-2">
              {card.choices.map((c) => (
                <RadioCard key={c} name={`w-${card.word}`} value={c} title={c} checked={answers[card.word] === c}
                  onChange={() => setAnswers({ ...answers, [card.word]: c })} />
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</Button>
              {i < run.cards.length - 1
                ? <Button variant="primary" disabled={!answers[card.word]} onClick={() => setI(i + 1)}>Next word</Button>
                : <Button variant="primary" disabled={!done || submit.isPending} onClick={() => submit.mutate()}>Check</Button>}
            </div>
          </CardBody>
        </Card>
      )}
      {submit.data && (
        <Card>
          <CardBody className="flex flex-col gap-2">
            <p className="text-lg font-semibold text-ink">{submit.data.correct} of {submit.data.total} exact</p>
            <p className="text-sm text-muted">{submit.data.passed ? "Six or more. The vocabulary meter records a pass." : "Five or fewer. Read the missed words again, then take a fresh set."}</p>
            {submit.data.missed.length > 0 && (
              <ul className="text-sm">{submit.data.missed.map((m: { word: string; tag: string }) => <li key={m.word} className="text-loss">{m.word} · {m.tag}</li>)}</ul>
            )}
            <Button variant="secondary" onClick={() => { setAnswers({}); setI(0); submit.reset(); void qc.invalidateQueries({ queryKey: qk.vocab }); }}>New set</Button>
          </CardBody>
        </Card>
      )}
      <Err error={submit.error} />
    </Screen>
  );
}
