import type { ScrId } from "@edge/contracts";
import { Button, IconBot, IconX } from "@edge/ui";
import { AgentChat } from "../screens/agent/chat";

export function AgentDrawer({ onClose, scr }: { onClose: () => void; scr?: ScrId }) {
  return (
    <aside aria-label="Tutor drawer" data-testid="agent-drawer"
      className="animate-fade-in fixed inset-x-0 bottom-0 z-40 flex h-[75dvh] flex-col rounded-t-card border border-hair bg-raised shadow-pop lg:sticky lg:top-32 lg:mt-6 lg:h-[calc(100dvh-11rem)] lg:w-[380px] lg:shrink-0 lg:rounded-card">
      <header className="flex items-center justify-between border-b border-hair px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><IconBot size={16} className="text-accent" /> Tutor</p>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close tutor drawer"><IconX size={16} /></Button>
      </header>
      <AgentChat compact scr={scr} />
    </aside>
  );
}
