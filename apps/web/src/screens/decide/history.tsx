import { Badge, Card, CardBody, Select } from "@edge/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { DECIDE_NAV, Screen, Stamp, StatusBadge } from "../../components/kit";
import { memosQuery } from "../../lib/queries";

export function HistoryScreen() {
  const [phase, setPhase] = useState<"" | "cash-put" | "shares-held">("");
  const [decision, setDecision] = useState<"" | "sell" | "skip" | "wait" | "cover_call">("");
  const data = useSuspenseQuery(memosQuery({ ...(phase ? { phase } : {}), ...(decision ? { decision } : {}) })).data;
  return (
    <Screen scr="SCR-033" eyebrow="Decide" title="Decision history" nav={DECIDE_NAV}
      lead={`This quarter: ${data.quarter.memos} memos, ${data.quarter.skips} skips. Skip is a decision.`}>
      <div className="flex flex-wrap gap-3">
        <Select aria-label="Phase" value={phase} onChange={(e) => setPhase(e.target.value as typeof phase)}>
          <option value="">All phases</option>
          <option value="cash-put">Cash-put</option>
          <option value="shares-held">Shares held</option>
        </Select>
        <Select aria-label="Decision" value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
          <option value="">All decisions</option>
          {["sell", "skip", "wait", "cover_call"].map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
      </div>
      <Card>
        <CardBody>
          <ul className="divide-y divide-hair">
            {data.items.map((m) => (
              <li key={m.memo_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <Link className="font-medium text-ink hover:text-accent" to={m.phase === "shares-held" ? "/decide/call-packet/$memoId" : "/decide/packet/$memoId"} params={{ memoId: m.memo_id }} search={{ candidate: undefined }}>
                    {m.decision_date} · {m.phase}
                  </Link>
                  <p className="text-xs text-muted">{m.top ? `${m.top.put_call} ${m.top.strike}` : "no strike"} {m.skip_code ? `· skip ${m.skip_code}` : ""} · <Stamp at={m.created_at} /></p>
                </div>
                <span className="flex gap-2">{m.decision ? <StatusBadge status={m.decision} /> : <Badge>{m.status}</Badge>}</span>
              </li>
            ))}
            {data.items.length === 0 && <li className="py-6 text-sm text-muted">No memos match.</li>}
          </ul>
        </CardBody>
      </Card>
    </Screen>
  );
}
