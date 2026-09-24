import type { ScrId } from "@edge/contracts";
import { APPROVED } from "@edge/copy";
import { CopyText } from "@edge/ui";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../../components/kit";
import { agentStatusQuery } from "../../lib/queries";

export function AgentPage() {
  return (
    <Screen scr="SCR-060" eyebrow="Agent" title="Tutor" lead="Ask about a screen, a word, or a draft. The tutor cannot place or approve an order.">
      <AgentChat scr="SCR-060" />
    </Screen>
  );
}

/** Placeholder until the E8 tool loop streams here. Safety copy is already on screen. */
export function AgentChat({ compact, scr }: { compact?: boolean; scr?: ScrId }) {
  const status = useQuery(agentStatusQuery());
  const online = status.data?.available;
  return (
    <div className={compact ? "flex flex-1 flex-col gap-3 overflow-auto p-4" : "flex flex-col gap-4"} data-testid="agent-chat" data-scr={scr}>
      <p className="text-sm text-muted"><CopyText text={APPROVED["agent.not_advice"]} /></p>
      <p className="rounded-control border border-hair bg-surface px-3 py-2 text-sm">
        Tutor model {online ? "is reachable" : "is offline"}.
        {status.data?.model ? ` ${status.data.model}.` : ""} All rule checks still run without it.
      </p>
    </div>
  );
}
