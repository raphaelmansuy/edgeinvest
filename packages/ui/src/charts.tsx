// SVG charts (docs/06 §7): d3 for maths only, React renders. Every chart has a text summary and a table alternative.
import { scaleBand, scaleLinear } from "d3-scale";
import { area, curveMonotoneX, line } from "d3-shape";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { cx } from "./primitives";

function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const usd0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const fmtCompact = (v: number) => compact.format(v);
export const fmtUsd0 = (v: number) => `${v < 0 ? "−" : ""}${usd0.format(Math.abs(v))}`;

export function Figure({ caption, summary, table, children }: { caption: ReactNode; summary: ReactNode; table?: ReactNode; children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-2">
      {children}
      <figcaption className="text-sm text-muted">
        <span className="font-medium text-ink">{caption}</span> {summary}
      </figcaption>
      {table && (
        <details className="group text-sm">
          <summary className="cursor-pointer text-xs font-medium text-accent select-none hover:underline">Show data table</summary>
          <div className="mt-2 max-h-72 overflow-auto rounded-control border border-hair">{table}</div>
        </details>
      )}
    </figure>
  );
}

export function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-surface text-muted">
        <tr>{head.map((h) => <th key={h} scope="col" className="px-3 py-1.5 text-left font-medium">{h}</th>)}</tr>
      </thead>
      <tbody className="num divide-y divide-hair">
        {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-1">{c}</td>)}</tr>)}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------- payoff
export interface PayoffProps {
  points: { s: number; pnl: number }[];
  strike: number;
  breakEven: number;
  spot: number;
  basis?: number;
  height?: number;
  label?: string;
}

/** Flat profit line above the strike, loss slope below; the x-axis includes 0 so the worst case is visible. */
export function PayoffChart({ points, strike, breakEven, spot, basis, height = 300, label = "Profit / loss at expiry" }: PayoffProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<{ s: number; pnl: number } | null>(null);
  const m = { t: 22, r: 16, b: 34, l: 64 };
  const xs = points.map((p) => p.s);
  const ys = points.map((p) => p.pnl);
  const x = scaleLinear().domain([0, Math.max(...xs)]).range([m.l, width - m.r]);
  const yMin = Math.min(...ys, 0);
  const yMax = Math.max(...ys, 0);
  const pad = (yMax - yMin) * 0.08 || 1;
  const y = scaleLinear().domain([yMin - pad, yMax + pad]).range([height - m.b, m.t]).nice();
  const path = line<{ s: number; pnl: number }>().x((d) => x(d.s)).y((d) => y(d.pnl))(points) ?? "";
  const areaPath = area<{ s: number; pnl: number }>().x((d) => x(d.s)).y0(y(0)).y1((d) => y(d.pnl))(points) ?? "";
  const zeroY = y(0);
  const marks = [
    { v: breakEven, label: "Break-even", cls: "stroke-ink/60", text: "fill-ink" },
    { v: strike, label: "Strike", cls: "stroke-accent", text: "fill-accent" },
    { v: spot, label: "Spot", cls: "stroke-muted", text: "fill-muted" },
    ...(basis ? [{ v: basis, label: "Basis", cls: "stroke-caution", text: "fill-caution" }] : []),
  ];
  const nearest = (px: number) => {
    const s = x.invert(px);
    return points.reduce((a, b) => (Math.abs(b.s - s) < Math.abs(a.s - s) ? b : a));
  };
  const worst = points[0]!;
  const best = Math.max(...ys);
  return (
    <Figure caption={label} summary={`Max profit ${fmtUsd0(best)} USD above the strike; break-even ${breakEven.toFixed(2)}; at 0 the loss is ${fmtUsd0(worst.pnl)} USD.`}
      table={<SimpleTable head={["QQQ at expiry", "P&L (USD)"]} rows={points.filter((_, i) => i % 6 === 0).map((p) => [p.s.toFixed(2), fmtUsd0(p.pnl)])} />}>
      <div ref={ref} className="relative w-full select-none" data-testid="payoff-chart">
        <svg width={width} height={height} role="img" aria-label={`${label}: payoff diagram`} className="overflow-visible"
          onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); setHover(nearest(e.clientX - r.left)); }}
          onMouseLeave={() => setHover(null)}>
          <defs>
            <clipPath id={`${gid}-above`}><rect x="0" y="0" width={width} height={zeroY} /></clipPath>
            <clipPath id={`${gid}-below`}><rect x="0" y={zeroY} width={width} height={height} /></clipPath>
            <linearGradient id={`${gid}-loss`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--color-loss)" stopOpacity="0.08" />
              <stop offset="1" stopColor="var(--color-loss)" stopOpacity="0.32" />
            </linearGradient>
            <linearGradient id={`${gid}-gain`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="var(--color-ok)" stopOpacity="0.06" />
              <stop offset="1" stopColor="var(--color-ok)" stopOpacity="0.22" />
            </linearGradient>
          </defs>
          {y.ticks(5).map((t) => (
            <g key={t}>
              <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} className="stroke-hair" />
              <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num fill-muted text-[10px]">{fmtCompact(t)}</text>
            </g>
          ))}
          {x.ticks(6).map((t) => (
            <text key={t} x={x(t)} y={height - m.b + 16} textAnchor="middle" className="num fill-muted text-[10px]">{t}</text>
          ))}
          <path d={areaPath} fill={`url(#${gid}-gain)`} clipPath={`url(#${gid}-above)`} />
          <path d={areaPath} fill={`url(#${gid}-loss)`} clipPath={`url(#${gid}-below)`} />
          <line x1={m.l} x2={width - m.r} y1={zeroY} y2={zeroY} className="stroke-ink/50" strokeDasharray="3 3" />
          <path d={path} fill="none" className="stroke-ink" strokeWidth={2.25} />
          {marks.map((mk, i) => (
            <g key={mk.label}>
              <line x1={x(mk.v)} x2={x(mk.v)} y1={m.t - 4} y2={height - m.b} className={mk.cls} strokeDasharray="4 3" strokeWidth={1.25} />
              <text x={x(mk.v)} y={m.t - 8 - (i % 2) * 11} textAnchor="middle" className={cx("text-[10px] font-semibold", mk.text)}>
                {mk.label} {mk.v.toFixed(2)}
              </text>
            </g>
          ))}
          <circle cx={x(0)} cy={y(worst.pnl)} r={4} className="fill-loss" />
          <text x={x(0) + 8} y={y(worst.pnl)} dy="0.32em" className="num fill-loss text-[10px] font-semibold">worst {fmtUsd0(worst.pnl)}</text>
          {hover && (
            <g pointerEvents="none">
              <line x1={x(hover.s)} x2={x(hover.s)} y1={m.t} y2={height - m.b} className="stroke-accent/60" />
              <circle cx={x(hover.s)} cy={y(hover.pnl)} r={4.5} className="fill-bg stroke-accent" strokeWidth={2} />
            </g>
          )}
          <text x={width - m.r} y={height - 4} textAnchor="end" className="fill-muted text-[10px]">QQQ price at expiry (USD)</text>
        </svg>
        {hover && (
          <div className="pointer-events-none absolute top-2 right-2 rounded-control border border-hair bg-raised/95 px-2.5 py-1.5 text-xs shadow-pop">
            <span className="text-muted">QQQ</span> <span className="num font-semibold">{hover.s.toFixed(2)}</span>
            <span className="mx-1.5 text-muted">→</span>
            <span className={cx("num font-semibold", hover.pnl < 0 ? "text-loss" : "text-ok")}>{fmtUsd0(hover.pnl)} USD</span>
          </div>
        )}
      </div>
    </Figure>
  );
}

// ---------------------------------------------------------------- multi-line (crash, backtest)
export interface Series { key: string; label: string; values: number[]; tone: "accent" | "loss" | "ok" | "muted" | "caution" | "ink"; dashed?: boolean; width?: number }
const STROKE = { accent: "stroke-accent", loss: "stroke-loss", ok: "stroke-ok", muted: "stroke-muted", caution: "stroke-caution", ink: "stroke-ink" } as const;
const FILL = { accent: "fill-accent", loss: "fill-loss", ok: "fill-ok", muted: "fill-muted", caution: "fill-caution", ink: "fill-ink" } as const;
const BG = { accent: "bg-accent", loss: "bg-loss", ok: "bg-ok", muted: "bg-muted", caution: "bg-caution", ink: "bg-ink" } as const;

export function LineChart({ dates, series, height = 320, baseline, markers = [], yLabel = "Wealth (USD)", caption, summary, secondary }: {
  dates: string[]; series: Series[]; height?: number; baseline?: number; markers?: { i: number; label: string }[];
  yLabel?: string; caption: string; summary: ReactNode; secondary?: { label: string; values: number[] };
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const m = { t: 16, r: 132, b: 30, l: 62 };
  const n = dates.length;
  const x = scaleLinear().domain([0, n - 1]).range([m.l, width - m.r]);
  const all = series.flatMap((s) => s.values).concat(baseline ?? []);
  const y = scaleLinear().domain([Math.min(...all) * 0.96, Math.max(...all) * 1.03]).range([height - m.b, m.t]).nice();
  const years = useMemo(() => dates.map((d, i) => [d.slice(0, 4), i] as const).filter(([yv, i]) => i === 0 || dates[i - 1]!.slice(0, 4) !== yv), [dates]);
  const yearStep = Math.max(1, Math.ceil(years.length / 8));
  const monthly = years.length <= 1;
  const labelsY = series.map((s) => ({ s, y: y(s.values.at(-1)!) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < labelsY.length; i++) if (labelsY[i]!.y - labelsY[i - 1]!.y < 13) labelsY[i]!.y = labelsY[i - 1]!.y + 13;
  const sec = secondary ? scaleLinear().domain([Math.min(...secondary.values), Math.max(...secondary.values)]).range([height - m.b, m.t + (height - m.t - m.b) * 0.55]) : null;
  return (
    <Figure caption={caption} summary={summary}
      table={<SimpleTable head={["Date", ...series.map((s) => s.label)]} rows={dates.map((d, i) => [d, ...series.map((s) => fmtUsd0(s.values[i]!))]).filter((_, i) => i % Math.ceil(n / 60) === 0)} />}>
      <div ref={ref} className="relative w-full select-none" data-testid="line-chart">
        <svg width={width} height={height} role="img" aria-label={caption}
          onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const i = Math.round(x.invert(e.clientX - r.left)); setHi(i >= 0 && i < n ? i : null); }}
          onMouseLeave={() => setHi(null)}>
          {y.ticks(5).map((t) => (
            <g key={t}>
              <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} className="stroke-hair" />
              <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num fill-muted text-[10px]">{fmtCompact(t)}</text>
            </g>
          ))}
          {monthly
            ? dates.map((d, i) => i % Math.ceil(n / 8) === 0 && <text key={d} x={x(i)} y={height - m.b + 16} textAnchor="middle" className="num fill-muted text-[10px]">{d.slice(5)}</text>)
            : years.filter((_, k) => k % yearStep === 0).map(([yv, i]) => <text key={yv} x={x(i)} y={height - m.b + 16} textAnchor="middle" className="num fill-muted text-[10px]">{yv}</text>)}
          {sec && secondary && (
            <path d={area<number>().x((_, i) => x(i)).y0(height - m.b).y1((v) => sec(v)).curve(curveMonotoneX)(secondary.values) ?? ""} className="fill-muted/10" />
          )}
          {baseline !== undefined && <line x1={m.l} x2={width - m.r} y1={y(baseline)} y2={y(baseline)} className="stroke-ink/40" strokeDasharray="2 4" />}
          {markers.map((mk) => (
            <g key={`${mk.i}-${mk.label}`}>
              <line x1={x(mk.i)} x2={x(mk.i)} y1={m.t} y2={height - m.b} className="stroke-caution/70" strokeDasharray="3 3" />
              <text x={x(mk.i) + 4} y={m.t + 10} className="fill-caution text-[10px] font-semibold">{mk.label}</text>
            </g>
          ))}
          {series.map((s) => (
            <path key={s.key} d={line<number>().x((_, i) => x(i)).y((v) => y(v)).curve(curveMonotoneX)(s.values) ?? ""} fill="none"
              className={STROKE[s.tone]} strokeWidth={s.width ?? 2} strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" />
          ))}
          {labelsY.map(({ s, y: ly }) => (
            <g key={s.key}>
              <circle cx={x(n - 1)} cy={y(s.values.at(-1)!)} r={3} className={FILL[s.tone]} />
              <text x={width - m.r + 8} y={ly} dy="0.32em" className={cx("text-[10.5px] font-semibold", FILL[s.tone])}>{s.label}</text>
            </g>
          ))}
          {hi !== null && <line x1={x(hi)} x2={x(hi)} y1={m.t} y2={height - m.b} className="stroke-ink/30" pointerEvents="none" />}
          <text x={m.l} y={height - 4} className="fill-muted text-[10px]">{yLabel}</text>
        </svg>
        {hi !== null && (
          <div className="pointer-events-none absolute top-2 left-18 min-w-44 rounded-control border border-hair bg-raised/95 px-3 py-2 text-xs shadow-pop">
            <p className="num mb-1 font-semibold text-ink">{dates[hi]}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-muted"><span className={cx("size-2 rounded-full", BG[s.tone])} />{s.label}</span>
                <span className="num font-medium text-ink">{fmtUsd0(s.values[hi]!)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </Figure>
  );
}

// ---------------------------------------------------------------- fan chart (MC)
export function FanChart({ fan, start, height = 300 }: { fan: { q: number; p05: number; p25: number; p50: number; p75: number; p95: number }[]; start: number; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const m = { t: 14, r: 70, b: 30, l: 62 };
  const x = scaleLinear().domain([0, fan.length - 1]).range([m.l, width - m.r]);
  const y = scaleLinear().domain([Math.min(start, ...fan.map((f) => f.p05)) * 0.97, Math.max(...fan.map((f) => f.p95)) * 1.02]).range([height - m.b, m.t]).nice();
  const band = (lo: keyof (typeof fan)[0], hi: keyof (typeof fan)[0]) =>
    area<(typeof fan)[0]>().x((d) => x(d.q)).y0((d) => y(d[lo])).y1((d) => y(d[hi])).curve(curveMonotoneX)(fan) ?? "";
  const last = fan.at(-1)!;
  return (
    <Figure caption="Wealth range across bootstrapped paths"
      summary={`After ${fan.length - 1} quarters: p05 ${fmtUsd0(last.p05)}, p50 ${fmtUsd0(last.p50)}, p95 ${fmtUsd0(last.p95)} USD. No single "expected" number is shown.`}
      table={<SimpleTable head={["Quarter", "p05", "p25", "p50", "p75", "p95"]} rows={fan.map((f) => [f.q, fmtUsd0(f.p05), fmtUsd0(f.p25), fmtUsd0(f.p50), fmtUsd0(f.p75), fmtUsd0(f.p95)])} />}>
      <div ref={ref} className="w-full" data-testid="fan-chart">
        <svg width={width} height={height} role="img" aria-label="Monte Carlo fan chart">
          {y.ticks(5).map((t) => (
            <g key={t}>
              <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} className="stroke-hair" />
              <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num fill-muted text-[10px]">{fmtCompact(t)}</text>
            </g>
          ))}
          {x.ticks(Math.min(10, fan.length - 1)).map((t) => <text key={t} x={x(t)} y={height - m.b + 16} textAnchor="middle" className="num fill-muted text-[10px]">Q{t}</text>)}
          <path d={band("p05", "p95")} className="fill-accent/12" />
          <path d={band("p25", "p75")} className="fill-accent/25" />
          <path d={line<(typeof fan)[0]>().x((d) => x(d.q)).y((d) => y(d.p50)).curve(curveMonotoneX)(fan) ?? ""} fill="none" className="stroke-accent" strokeWidth={2.25} />
          <line x1={m.l} x2={width - m.r} y1={y(start)} y2={y(start)} className="stroke-loss/70" strokeDasharray="4 4" />
          <text x={m.l + 4} y={y(start) - 5} className="fill-loss text-[10px] font-semibold">start {fmtCompact(start)}</text>
          {(["p95", "p50", "p05"] as const).map((k) => (
            <text key={k} x={width - m.r + 6} y={y(last[k])} dy="0.32em" className={cx("num text-[10px] font-semibold", k === "p50" ? "fill-accent" : "fill-muted")}>{k} {fmtCompact(last[k])}</text>
          ))}
        </svg>
      </div>
    </Figure>
  );
}

export function Histogram({ bins, marker, markerLabel = "start", height = 160 }: { bins: { lo: number; hi: number; count: number }[]; marker: number; markerLabel?: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const m = { t: 10, r: 10, b: 24, l: 10 };
  const x = scaleLinear().domain([bins[0]!.lo, bins.at(-1)!.hi]).range([m.l, width - m.r]);
  const y = scaleLinear().domain([0, Math.max(...bins.map((b) => b.count))]).range([height - m.b, m.t]);
  return (
    <div ref={ref} className="w-full" data-testid="histogram">
      <svg width={width} height={height} role="img" aria-label="Distribution of ending wealth">
        {bins.map((b) => (
          <rect key={b.lo} x={x(b.lo) + 1} width={Math.max(1, x(b.hi) - x(b.lo) - 2)} y={y(b.count)} height={height - m.b - y(b.count)} rx={2}
            className={b.hi <= marker ? "fill-loss/55" : "fill-accent/45"} />
        ))}
        <line x1={x(marker)} x2={x(marker)} y1={m.t} y2={height - m.b} className="stroke-loss" strokeDasharray="3 3" />
        <text x={x(marker) + 4} y={m.t + 10} className="fill-loss text-[10px] font-semibold">{markerLabel}</text>
        {x.ticks(5).map((t) => <text key={t} x={x(t)} y={height - 6} textAnchor="middle" className="num fill-muted text-[10px]">{fmtCompact(t)}</text>)}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------- bars (ledger by quarter)
export function SignedBars({ items, height = 220, caption }: { items: { label: string; credit: number; debit: number }[]; height?: number; caption: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const m = { t: 12, r: 12, b: 28, l: 58 };
  const x = scaleBand().domain(items.map((i) => i.label)).range([m.l, width - m.r]).padding(0.35);
  const max = Math.max(1, ...items.map((i) => Math.max(i.credit, -i.debit)));
  const y = scaleLinear().domain([-max, max]).range([height - m.b, m.t]).nice();
  return (
    <Figure caption={caption} summary={items.length ? `${items.length} quarter(s). Credits above the line, debits below.` : "No entries yet."}
      table={<SimpleTable head={["Quarter", "Credits", "Debits", "Net"]} rows={items.map((i) => [i.label, fmtUsd0(i.credit), fmtUsd0(i.debit), fmtUsd0(i.credit + i.debit)])} />}>
      <div ref={ref} className="w-full" data-testid="ledger-bars">
        <svg width={width} height={height} role="img" aria-label={caption}>
          {y.ticks(4).map((t) => (
            <g key={t}>
              <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-ink/40" : "stroke-hair"} />
              <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num fill-muted text-[10px]">{fmtCompact(t)}</text>
            </g>
          ))}
          {items.map((i) => (
            <g key={i.label}>
              <rect x={x(i.label)} width={x.bandwidth()} y={y(i.credit)} height={y(0) - y(i.credit)} rx={3} className="fill-ok/70" />
              <rect x={x(i.label)} width={x.bandwidth()} y={y(0)} height={y(i.debit) - y(0)} rx={3} className="fill-loss/60" />
              <text x={(x(i.label) ?? 0) + x.bandwidth() / 2} y={height - 8} textAnchor="middle" className="num fill-muted text-[10px]">{i.label}</text>
            </g>
          ))}
        </svg>
      </div>
    </Figure>
  );
}

export function Sparkline({ values, className, tone = "accent" }: { values: number[]; className?: string; tone?: Series["tone"] }) {
  const w = 120, h = 32;
  const x = scaleLinear().domain([0, values.length - 1]).range([2, w - 2]);
  const y = scaleLinear().domain([Math.min(...values), Math.max(...values)]).range([h - 3, 3]);
  return (
    <svg width={w} height={h} className={className} aria-hidden>
      <path d={line<number>().x((_, i) => x(i)).y((v) => y(v)).curve(curveMonotoneX)(values) ?? ""} fill="none" className={STROKE[tone]} strokeWidth={1.75} />
    </svg>
  );
}
