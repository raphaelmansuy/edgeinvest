import { Badge, Button, Card, CardBody, Select } from "@edge/ui";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { JOURNAL_NAV, Screen, Stamp } from "../../components/kit";
import { api, unwrap } from "../../lib/api";
import { auditQuery } from "../../lib/queries";

export function AuditScreen() {
  const [action, setAction] = useState("");
  const page = useSuspenseQuery(auditQuery(action || undefined)).data;
  const verify = useQuery({ queryKey: ["journal", "audit", "verify"], queryFn: () => unwrap(api.audit.verify.$get()), enabled: false });
  return (
    <Screen scr="SCR-050" eyebrow="Journal" title="Audit chain" nav={JOURNAL_NAV}
      lead="Every decision, draft and export is appended here. Verify recomputes the hash chain."
      actions={<Button variant="secondary" disabled={verify.isFetching} onClick={() => verify.refetch()}>{verify.data ? (verify.data.ok ? "Chain intact" : "Chain broken") : "Verify"}</Button>}>
      <Select aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)}>
        <option value="">All actions</option>
        {page.actions.map((a) => <option key={a.action} value={a.action}>{a.action} ({a.n})</option>)}
      </Select>
      <ul className="flex flex-col gap-2">
        {page.items.map((e) => (
          <li key={String(e.seq)}>
            <Card>
              <CardBody>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-ink"><span className="num text-muted">#{String(e.seq)}</span> {e.action}</p>
                  <span className="flex items-center gap-2"><Badge>{e.actor}</Badge>{e.scr_id && <Badge tone="accent">{e.scr_id}</Badge>}<Stamp at={e.ts} /></span>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-accent">Payload</summary>
                  <pre className="mt-2 overflow-auto text-xs text-muted">{JSON.stringify(e.payload, null, 2)}</pre>
                </details>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
