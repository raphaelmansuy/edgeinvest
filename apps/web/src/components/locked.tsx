import { SCREENS, type ScrId } from "@edge/contracts";
import { EmptyArt, PageHeader, buttonClass } from "@edge/ui";
import { Link } from "@tanstack/react-router";

const WHY: Record<string, { title: string; body: string; to: string; cta: string }> = {
  phase_shares_held: {
    title: "This screen belongs to the share phase",
    body: "You reach it only after a put is assigned and you hold 100 QQQ shares. Until then the covered-call tools stay locked, so you cannot plan a call on shares you do not own.",
    to: "/learn/wheel", cta: "See how the wheel turns",
  },
  phase_cash_put: {
    title: "You hold assigned shares",
    body: "While shares are held the put tools are locked (one lot at a time). Work the share phase first.",
    to: "/decide/put-lock", cta: "Why puts are locked",
  },
  open_short_put: { title: "No open short put", body: "Assignment is recorded against an open short put. There is none right now.", to: "/", cta: "Go home" },
  open_cycle: { title: "No open cycle", body: "There is no open wheel cycle to follow.", to: "/", cta: "Go home" },
};

/** Guards without a registry fallback render this state instead of redirecting (docs/05 §1). */
export function LockedScreen({ scr }: { scr: ScrId }) {
  const s = SCREENS[scr];
  const w = WHY[s.guard] ?? { title: "Locked", body: "This screen is not available yet.", to: "/", cta: "Go home" };
  return (
    <div data-testid="locked-screen">
      <PageHeader scr={scr} title={s.name.split(" › ").at(-1)!} eyebrow={s.area} />
      <div className="flex flex-col items-center gap-4 rounded-card border border-dashed border-control/40 bg-surface/60 px-6 py-14 text-center">
        <EmptyArt kind="lock" />
        <h2 className="text-lg font-semibold text-ink">{w.title}</h2>
        <p className="max-w-lg text-sm text-muted">{w.body}</p>
        <Link to={w.to} className={buttonClass("primary")}>{w.cta}</Link>
      </div>
    </div>
  );
}
