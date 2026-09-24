import { Card, CardBody, WheelDiagram } from "@edge/ui";
import { useState } from "react";
import { ModuleScreen } from "./module";

type WheelNode = "cash" | "short_put" | "shares" | "short_call";
const NODES: { id: WheelNode; title: string; body: string }[] = [
  { id: "cash", title: "Cash", body: "Settled USD sits ready. No option is open. This is where a new put starts." },
  { id: "short_put", title: "Short put", body: "You sold one cash-secured put. The reserve is idle until expiry, assignment or a buyback." },
  { id: "shares", title: "Shares held", body: "Assignment turned the promise into 100 shares. Decision basis is strike minus the premium you kept." },
  { id: "short_call", title: "Short call", body: "One covered call, strike at or above basis. Called away returns you to cash." },
];

export function WheelLearnScreen() {
  const [active, setActive] = useState<WheelNode>("cash");
  const node = NODES.find((n) => n.id === active)!;
  return (
    <>
      <ModuleScreen slug="wheel" scr="SCR-005" />
      <div className="mx-auto mt-6 grid max-w-[1400px] items-center gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardBody className="flex justify-center py-6">
            <WheelDiagram active={active} size={240} />
          </CardBody>
        </Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {NODES.map((n) => (
              <button key={n.id} type="button" onClick={() => setActive(n.id)}
                className={n.id === active ? "rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink" : "rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-muted"}>
                {n.title}
              </button>
            ))}
          </div>
          <h2 className="text-lg font-semibold text-ink">{node.title}</h2>
          <p className="text-sm leading-relaxed text-muted">{node.body}</p>
        </div>
      </div>
    </>
  );
}
