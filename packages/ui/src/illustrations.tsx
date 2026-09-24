import type { Phase } from "@edge/domain";
import { cx } from "./primitives";

type WheelNode = "cash" | "short_put" | "shares" | "short_call";
const NODES: { id: WheelNode; label: string; sub: string; angle: number }[] = [
  { id: "cash", label: "Cash", sub: "reserve sits idle", angle: -90 },
  { id: "short_put", label: "Short put", sub: "collect premium", angle: 0 },
  { id: "shares", label: "Shares", sub: "assigned at strike", angle: 90 },
  { id: "short_call", label: "Covered call", sub: "strike ≥ basis", angle: 180 },
];
const EDGES: { from: WheelNode; to: WheelNode; label: string }[] = [
  { from: "cash", to: "short_put", label: "sell put" },
  { from: "short_put", to: "shares", label: "assigned" },
  { from: "shares", to: "short_call", label: "sell call" },
  { from: "short_call", to: "cash", label: "called away" },
];

export function wheelNodeOf(phase: Phase, openShortPut: boolean, openShortCall: boolean): WheelNode {
  if (phase === "cash-put") return openShortPut ? "short_put" : "cash";
  return openShortCall ? "short_call" : "shares";
}

/** The wheel as a state diagram (docs/03 §2); the current node is highlighted, others muted. */
export function WheelDiagram({ active, size = 300, className }: { active?: WheelNode; size?: number; className?: string }) {
  const c = size / 2;
  const R = size * 0.34;
  const pos = (a: number) => ({ x: c + R * Math.cos((a * Math.PI) / 180), y: c + R * Math.sin((a * Math.PI) / 180) });
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      style={{ maxWidth: size }}
      className={className}
      role="img"
      aria-label={`Wheel cycle: cash, short put, shares, covered call${active ? `; you are at ${active.replace("_", " ")}` : ""}`}
      data-testid="wheel-diagram"
    >
      <defs>
        <marker id="wd-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" className="fill-muted" />
        </marker>
        <radialGradient id="wd-glow">
          <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={c} cy={c} r={R} fill="none" className="stroke-hair" strokeWidth={size * 0.05} />
      {EDGES.map((e) => {
        const a0 = NODES.find((n) => n.id === e.from)!.angle + 20;
        let a1 = NODES.find((n) => n.id === e.to)!.angle - 20;
        if (a1 < a0) a1 += 360;
        const p0 = pos(a0),
          p1 = pos(a1);
        const mid = pos((a0 + a1) / 2);
        const lp = { x: c + (mid.x - c) * 1.32, y: c + (mid.y - c) * 1.32 };
        return (
          <g key={e.label}>
            <path
              d={`M${p0.x} ${p0.y} A${R} ${R} 0 0 1 ${p1.x} ${p1.y}`}
              fill="none"
              className="stroke-muted/70"
              strokeWidth={1.5}
              markerEnd="url(#wd-arrow)"
            />
            <text x={lp.x} y={lp.y} textAnchor="middle" dy="0.32em" className="fill-muted text-[10px] italic">
              {e.label}
            </text>
          </g>
        );
      })}
      {NODES.map((n) => {
        const p = pos(n.angle);
        const on = n.id === active;
        return (
          <g key={n.id} data-node={n.id} data-active={on}>
            {on && <circle cx={p.x} cy={p.y} r={size * 0.16} fill="url(#wd-glow)" />}
            <circle
              cx={p.x}
              cy={p.y}
              r={size * 0.085}
              className={cx(on ? "fill-accent" : "fill-raised stroke-control/50")}
              strokeWidth={1.5}
            />
            <text x={p.x} y={p.y} dy="0.35em" textAnchor="middle" className={cx("text-[11px] font-bold", on ? "fill-white" : "fill-ink")}>
              {n.label.split(" ")[0]}
            </text>
            <text x={p.x} y={p.y + size * 0.085 + 12} textAnchor="middle" className="fill-muted text-[9.5px]">
              {n.sub}
            </text>
          </g>
        );
      })}
      <text x={c} y={c - 6} textAnchor="middle" className="fill-ink text-[12px] font-semibold">
        one lot
      </text>
      <text x={c} y={c + 10} textAnchor="middle" className="fill-muted text-[10px]">
        QQQ · 100 shares
      </text>
    </svg>
  );
}

/** Welcome hero: the strike rail is the subject. Decorative path sits above it. */
export function HeroArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 260" className={className} aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <line key={i} x1="10" x2="410" y1={36 + i * 28} y2={36 + i * 28} className="stroke-hair" strokeWidth="1" />
      ))}
      <path
        d="M10 168 C60 148 80 88 130 108 S190 40 230 68 S280 188 320 148 S380 58 410 68"
        fill="none"
        className="stroke-ink/70"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="320" cy="148" r="5" className="fill-bg stroke-accent" strokeWidth="2" />
      <g className="animate-rail">
        <line x1="10" x2="410" y1="196" y2="196" className="stroke-accent" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <text x="16" y="222" className="fill-accent font-serif text-[13px] italic">
        you may have to buy here
      </text>
    </svg>
  );
}

export type EmptyKind = "memo" | "cycle" | "ledger" | "audit" | "chart" | "chat" | "lock";
/** Small line-art for empty states and locked screens. */
export function EmptyArt({ kind, className }: { kind: EmptyKind; className?: string }) {
  const common = "fill-none stroke-current";
  const body: Record<EmptyKind, React.ReactNode> = {
    memo: (
      <>
        <rect x="18" y="10" width="44" height="58" rx="6" className={common} />
        <path d="M28 26h24M28 36h24M28 46h14" className={common} />
        <circle cx="58" cy="60" r="10" className="fill-bg stroke-current" />
        <path d="m54 60 3 3 5-6" className={common} />
      </>
    ),
    cycle: (
      <>
        <circle cx="40" cy="40" r="24" className={common} strokeDasharray="5 5" />
        <path d="M40 16v8M64 40h-8M40 64v-8M16 40h8" className={common} />
        <circle cx="40" cy="40" r="6" className="fill-current opacity-40" />
      </>
    ),
    ledger: (
      <>
        <path d="M14 64h52" className={common} />
        <rect x="20" y="40" width="9" height="24" rx="2" className={common} />
        <rect x="36" y="28" width="9" height="36" rx="2" className={common} />
        <rect x="52" y="48" width="9" height="16" rx="2" className={common} />
      </>
    ),
    audit: (
      <>
        <path d="M40 12 62 20v18c0 14-9 24-22 30-13-6-22-16-22-30V20Z" className={common} />
        <path d="m31 40 6 6 12-13" className={common} />
      </>
    ),
    chart: (
      <>
        <path d="M14 62h52M14 62V14" className={common} />
        <path d="M18 52c10-4 14-22 24-18s12 14 20-10" className={common} />
      </>
    ),
    chat: (
      <>
        <rect x="12" y="16" width="44" height="30" rx="8" className={common} />
        <path d="M24 46v10l10-10" className={common} />
        <rect x="36" y="34" width="32" height="22" rx="7" className="fill-bg stroke-current" />
      </>
    ),
    lock: (
      <>
        <rect x="20" y="36" width="40" height="30" rx="6" className={common} />
        <path d="M28 36V26a12 12 0 0 1 24 0v10" className={common} />
        <circle cx="40" cy="50" r="3.5" className="fill-current" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 80 80"
      width="72"
      height="72"
      className={cx("text-control", className)}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {body[kind]}
    </svg>
  );
}
