import { Card, CardBody, WheelDiagram } from "@edge/ui";
import { Link } from "@tanstack/react-router";
import { DECIDE_NAV, Screen } from "../../components/kit";

export function PutLockScreen() {
  return (
    <Screen scr="SCR-039" eyebrow="Shares" title="Puts are locked while you hold shares" nav={DECIDE_NAV}
      lead="One lot. A new cash-secured put waits until the shares are called away or sold. That is the wheel, not a restriction you can click past.">
      <div className="grid items-center gap-6 lg:grid-cols-[260px_1fr]">
        <Card><CardBody className="flex justify-center py-6"><WheelDiagram active="shares" size={220} /></CardBody></Card>
        <div className="flex flex-col gap-3 text-sm leading-relaxed">
          <p>The cash-put screens stay closed until the phase returns to cash. Covered calls are the work of this phase.</p>
          <p>If you were sent here from Candidates or the put playbook, the guard did that on purpose.</p>
          <Link to="/decide/call-candidates" search={{ candidate: undefined }} className="font-medium text-accent hover:underline">Score a covered call →</Link>
        </div>
      </div>
    </Screen>
  );
}
