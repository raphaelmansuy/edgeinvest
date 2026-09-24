import type { ScrId } from "@edge/contracts";
import { Badge, Card, CardBody, CitationChip, ClaimLabel } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { LEARN_NAV, Prose, Screen } from "../../components/kit";
import { curriculumQuery, moduleQuery } from "../../lib/queries";

export function ModuleScreen({ slug, scr }: { slug: string; scr: ScrId }) {
  const mod = useSuspenseQuery(moduleQuery(slug)).data;
  const all = useSuspenseQuery(curriculumQuery()).data;
  const i = all.findIndex((m) => m.slug === slug);
  const prev = i > 0 ? all[i - 1] : undefined;
  const next = all[i + 1];
  return (
    <Screen scr={scr} eyebrow={mod.code} title={mod.title} lead={mod.lead} nav={LEARN_NAV}
      actions={<Badge tone="neutral">v{mod.content_version}</Badge>}>
      <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
        <div className="flex flex-col gap-4">
          {mod.sections.map((s) => (
            <Card key={s.id} id={s.id}>
              <CardBody className="flex flex-col gap-3">
                <h2 className="text-base font-semibold text-ink">{s.heading}</h2>
                {s.claim && <ClaimLabel label={s.claim} />}
                <Prose text={s.body} />
              </CardBody>
            </Card>
          ))}
        </div>
        <aside className="flex flex-col gap-4">
          <Card>
            <CardBody>
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">On this page</p>
              <ol className="mt-2 space-y-1 text-sm">
                {mod.sections.map((s, n) => <li key={s.id}><a className="text-accent hover:underline" href={`#${s.id}`}>{n + 1}. {s.heading}</a></li>)}
              </ol>
            </CardBody>
          </Card>
          {mod.sources.length > 0 && (
            <Card>
              <CardBody className="flex flex-col gap-2">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">Sources</p>
                {mod.sources.map((s) => <CitationChip key={s.url} title={s.title} href={s.url} source={s.title} />)}
              </CardBody>
            </Card>
          )}
          <p className="text-sm text-muted">
            {prev && <a className="font-medium text-accent hover:underline" href={`/learn/${prev.slug}`}>← {prev.title}</a>}
            {prev && next && " · "}
            {next && <a className="font-medium text-accent hover:underline" href={`/learn/${next.slug}`}>{next.title} →</a>}
          </p>
        </aside>
      </div>
    </Screen>
  );
}
