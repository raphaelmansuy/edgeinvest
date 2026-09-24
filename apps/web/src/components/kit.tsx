import type { ScrId } from "@edge/contracts";
import { Badge, CopyText, cx, PageHeader, ProblemAlert } from "@edge/ui";
import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { ApiProblem } from "../lib/api";

export function Screen({
  scr,
  eyebrow,
  title,
  lead,
  actions,
  nav,
  children,
}: {
  scr: ScrId;
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  nav?: { to: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader scr={scr} eyebrow={eyebrow} title={title} lead={lead} actions={actions} />
      {nav && <SubNav items={nav} />}
      {children}
    </div>
  );
}

export function SubNav({ items }: { items: { to: string; label: string }[] }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Section"
      className="-mt-2 flex gap-1 overflow-x-auto pb-1"
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
        const links = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLAnchorElement>("a"));
        if (!links.length) return;
        const i = links.findIndex((a) => a === document.activeElement);
        let next = i;
        if (e.key === "ArrowRight") next = i < 0 ? 0 : (i + 1) % links.length;
        if (e.key === "ArrowLeft") next = i < 0 ? links.length - 1 : (i - 1 + links.length) % links.length;
        if (e.key === "Home") next = 0;
        if (e.key === "End") next = links.length - 1;
        e.preventDefault();
        links[next]?.focus();
      }}
    >
      {items.map((it) => {
        const on = path === it.to || path.startsWith(`${it.to}/`);
        return (
          <Link
            key={it.to}
            to={it.to}
            aria-current={on ? "page" : undefined}
            className={cx(
              "shrink-0 rounded-control px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
              on ? "bg-accent text-accent-ink" : "bg-surface text-muted hover:text-ink",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const LEARN_NAV = [
  { to: "/learn/why", label: "WHY" },
  { to: "/learn/seven-words", label: "Seven words" },
  { to: "/learn/three-layer", label: "Three-layer" },
  { to: "/learn/arithmetic", label: "Arithmetic" },
  { to: "/learn/wheel", label: "Wheel" },
  { to: "/learn/quizzes/M1", label: "Quizzes" },
  { to: "/learn/game", label: "Game" },
];
export const SIM_NAV = [
  { to: "/simulate/payoff", label: "Payoff" },
  { to: "/simulate/crash", label: "Crash" },
  { to: "/simulate/monte-carlo", label: "Monte Carlo" },
  { to: "/simulate/backtest", label: "Backtest" },
];
export const DECIDE_NAV = [
  { to: "/decide/inputs", label: "Inputs" },
  { to: "/decide/snapshot", label: "Snapshot" },
  { to: "/decide/candidates", label: "Candidates" },
  { to: "/decide/history", label: "History" },
  { to: "/decide/willingness", label: "Willingness" },
  { to: "/decide/put-lock", label: "Put lock" },
];
export const JOURNAL_NAV = [
  { to: "/journal/audit", label: "Audit" },
  { to: "/journal/tax-hk", label: "HK tax" },
  { to: "/journal/lessons", label: "Lessons" },
];
export const ME_NAV = [
  { to: "/me/settings", label: "Settings" },
  { to: "/me/envelope", label: "Envelope" },
  { to: "/me/mode", label: "Mode" },
  { to: "/me/compliance", label: "Compliance" },
];

export function Prose({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-ink/90">
      {text.split(/\n\n+/).map((p, i) => (
        <p key={i}>
          <CopyText text={p} />
        </p>
      ))}
    </div>
  );
}

export function Err({ error }: { error: ApiProblem | null }) {
  if (!error) return null;
  return <ProblemAlert problem={error.problem} />;
}

export function Stamp({ at }: { at: string | Date | null | undefined }) {
  if (!at) return <span className="text-muted">—</span>;
  const d = typeof at === "string" ? new Date(at) : at;
  return (
    <time className="num text-xs text-muted" dateTime={d.toISOString()}>
      {d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
    </time>
  );
}

const STATUS_TONE = {
  open: "accent",
  approved: "ok",
  submitted_by_user: "ok",
  blocked: "loss",
  building: "accent",
  decided: "neutral",
  discarded: "neutral",
} as const;
export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status as keyof typeof STATUS_TONE] ?? "neutral";
  return <Badge tone={tone}>{status.replaceAll("_", " ")}</Badge>;
}

export function num(v: string | number | null | undefined, dp = 2) {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: dp, minimumFractionDigits: dp }) : String(v);
}
