import type { ProblemDetails } from "@edge/contracts";
import { REASON_TEXT } from "@edge/domain";
import { type ReactNode, useId, useState } from "react";
import { IconAlert, IconArrowRight, IconCheck, IconClock, IconInfo, IconLock, IconX } from "./icons";
import { type MoneyLike, MoneyText, Pct } from "./money";
import { Badge, Button, cx, Stat, TextInput } from "./primitives";

const HKT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Hong_Kong",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const ET = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  month: "short",
  day: "2-digit",
});
export const fmtHkt = (d: Date | string) => `${HKT.format(new Date(d))} HKT`;
export const fmtEt = (d: Date | string) => `${ET.format(new Date(d))} ET`;
const DATE = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const fmtDate = (iso: string | Date) => DATE.format(typeof iso === "string" ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : iso);

/** Every "as of" shows HKT and ET (EC-TM-004); amber + "stale" text beyond the window. */
export function AsOfStamp({ at, stale, label = "as of" }: { at: Date | string | null | undefined; stale?: boolean; label?: string }) {
  if (!at) return <span className="text-xs text-muted">no data yet</span>;
  return (
    <span
      className={cx("inline-flex flex-wrap items-center gap-1.5 text-xs", stale ? "font-semibold text-caution" : "text-muted")}
      data-testid="as-of"
    >
      <IconClock size={13} />
      <span>{label}</span>
      <time dateTime={new Date(at).toISOString()} className="num">
        {fmtHkt(at)}
      </time>
      <span className="text-muted/70" aria-hidden>
        –
      </span>
      <span className="num">{fmtEt(at)}</span>
      {stale && <Badge tone="caution">stale</Badge>}
    </span>
  );
}

export type PutNumbers = { kind: "put"; reserve: MoneyLike; maxProfit: MoneyLike; breakEven: MoneyLike; worstCase: MoneyLike };
export type CallNumbers = {
  kind: "call";
  sharesCovered: number;
  creditOnly: MoneyLike;
  maxProfit: MoneyLike;
  worstCase: MoneyLike;
  lockedLoss: boolean;
  basis: MoneyLike;
};

/** Reserve, max profit, break-even — always before any score (US-1, EC-UX-001). null ⇒ dashes. */
export function TicketThreeNumbers({ inv, qty = 1 }: { inv: PutNumbers | CallNumbers | null; qty?: number }) {
  if (!inv || inv.kind === "put") {
    const p = inv as PutNumbers | null;
    return (
      <div data-testid="three-numbers">
        <div className="strike-rail mb-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Reserve" hint={`strike × 100 × ${qty} · cash that sits idle`}>
              <MoneyText value={p?.reserve} />
            </Stat>
            <Stat label="Max profit" hint="premium × 100 · before fees">
              <MoneyText value={p?.maxProfit} />
            </Stat>
            <Stat label="Break-even" hint="strike − premium, per share">
              <MoneyText value={p?.breakEven} />
            </Stat>
          </div>
          <span className="strike-rail-label">you may have to buy here</span>
        </div>
        <WorstCaseLine worstCase={p?.worstCase} />
      </div>
    );
  }
  return (
    <div data-testid="three-numbers">
      <div className="strike-rail mb-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Shares covered" hint="100 per contract">
            <span>{inv.sharesCovered}</span>
          </Stat>
          <Stat label="Credit" hint="premium × 100 · before fees">
            <MoneyText value={inv.creditOnly} />
          </Stat>
          <Stat label="Max profit if called" hint="credit + (strike − basis) × shares" tone={inv.lockedLoss ? "loss" : undefined}>
            <MoneyText value={inv.maxProfit} sign />
          </Stat>
        </div>
        <span className="strike-rail-label">strike at or above basis</span>
      </div>
      <WorstCaseLine worstCase={inv.worstCase} label="Worst case (QQQ → 0, shares + credit)" />
    </div>
  );
}

export function WorstCaseLine({ worstCase, label = "Worst case (QQQ → 0)" }: { worstCase: MoneyLike; label?: string }) {
  return (
    <p
      className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-control border border-loss/25 bg-loss/5 px-3 py-2 text-sm"
      data-testid="worst-case"
    >
      <span className="font-medium text-ink">{label}</span>
      <MoneyText value={worstCase} className="text-base font-semibold text-loss" unit />
      <span className="text-xs text-muted">if you are assigned and QQQ goes to zero</span>
    </p>
  );
}

export function BidAskStrip({
  bid,
  ask,
  asOf,
  stale,
  onRefresh,
}: {
  bid: MoneyLike;
  ask: MoneyLike;
  asOf?: Date | string | null;
  stale?: boolean;
  onRefresh?: ReactNode;
}) {
  if (bid === null || bid === undefined || ask === null || ask === undefined) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-2 rounded-control border border-caution/40 bg-caution/8 px-3 py-2 text-sm"
        data-testid="bid-ask-refusal"
      >
        <IconAlert size={16} className="text-caution" />
        <span className="font-medium">No quote, refusing to invent one.</span>
        {onRefresh}
      </div>
    );
  }
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" data-testid="bid-ask">
      <span className="text-muted">
        Bid <MoneyText value={bid} className="font-semibold text-ink" />
      </span>
      <span className="text-muted">×</span>
      <span className="text-muted">
        Ask <MoneyText value={ask} className="font-semibold text-ink" />
      </span>
      <AsOfStamp at={asOf} stale={stale} />
    </div>
  );
}

/** Skip → Wait → Prepare, same size, in DOM order (US-7, EC-UX-002). */
export function DecisionBar({
  onSkip,
  onWait,
  onPrepare,
  prepareDisabledReasons = [],
  busy,
  prepareLabel = "Prepare draft",
}: {
  onSkip: () => void;
  onWait: () => void;
  onPrepare: () => void;
  prepareDisabledReasons?: string[];
  busy?: boolean;
  prepareLabel?: string;
}) {
  const id = useId();
  const disabled = prepareDisabledReasons.length > 0;
  return (
    <div className="flex flex-col gap-3" data-testid="decision-bar">
      <div className="grid grid-cols-3 gap-3">
        <Button size="lg" onClick={onSkip} data-testid="skip" className="w-full">
          Skip this month
        </Button>
        <Button size="lg" onClick={onWait} data-testid="wait" className="w-full">
          Wait
        </Button>
        <Button
          size="lg"
          variant="primary"
          onClick={onPrepare}
          disabled={disabled || busy}
          aria-describedby={disabled ? id : undefined}
          data-testid="prepare"
          className="w-full"
        >
          {prepareLabel}
        </Button>
      </div>
      {disabled && (
        <ul id={id} className="space-y-1 text-sm text-muted" data-testid="prepare-reasons">
          {prepareDisabledReasons.map((r) => (
            <li key={r} className="flex items-start gap-2">
              <IconLock size={14} className="mt-0.5 shrink-0 text-caution" />
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface RuleResultView {
  id: string;
  pass: boolean;
  severity: "block" | "warn";
  reason?: string;
}

/** Registry order, failing rules first; each failing rule names the fix (docs/06 §5). */
export function ChecklistPanel({ results, fixLink }: { results: RuleResultView[]; fixLink?: (reason: string) => ReactNode }) {
  const ordered = [...results].sort(
    (a, b) => Number(a.pass) - Number(b.pass) || (a.severity === "block" ? -1 : 1) - (b.severity === "block" ? -1 : 1),
  );
  return (
    <ol className="divide-y divide-hair" data-testid="checklist">
      {ordered.map((r) => {
        const t = r.reason ? REASON_TEXT[r.reason] : undefined;
        const warn = !r.pass && r.severity === "warn";
        return (
          <li key={r.id} className="flex items-start gap-3 py-2.5" data-rule={r.id} data-pass={r.pass}>
            <span
              className={cx(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                r.pass ? "bg-ok/15 text-ok" : warn ? "bg-caution/15 text-caution" : "bg-loss/15 text-loss",
              )}
            >
              {r.pass ? <IconCheck size={13} /> : warn ? <IconAlert size={12} /> : <IconX size={13} />}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="num text-xs text-muted">{r.id}</span>
                <span className={cx("font-medium", r.pass ? "text-ink" : warn ? "text-caution" : "text-loss")}>
                  {r.pass ? "passed" : warn ? "warning" : "blocked"}
                  {r.reason ? ` · ${r.reason}` : ""}
                </span>
              </p>
              {!r.pass && t && (
                <p className="mt-0.5 text-ink/85">
                  <span className="font-medium">{t.title}.</span> {t.fix} {fixLink?.(r.reason!)}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export type ClaimKind = "illustrative_meeting" | "sourced_sim" | "unconfirmed";
const CLAIM: Record<ClaimKind, { text: string; tone: "accent" | "caution" | "neutral" }> = {
  illustrative_meeting: { text: "illustrative (meeting)", tone: "neutral" },
  sourced_sim: { text: "sourced simulation", tone: "accent" },
  unconfirmed: { text: "UNCONFIRMED", tone: "caution" },
};
export function ClaimLabel({ label, children }: { label: ClaimKind; children?: ReactNode }) {
  return (
    <span data-claim={label} className="inline-flex flex-wrap items-center gap-2">
      <Badge tone={CLAIM[label].tone} icon={<IconInfo size={12} />}>
        {CLAIM[label].text}
      </Badge>
      {children}
    </span>
  );
}

/** Two separate legs; there is deliberately no "total" prop (G15, CP-BLEND). */
export function YieldStack({
  premiumYieldAnn,
  periodYield,
  dte,
  tbill,
}: {
  premiumYieldAnn: number | null;
  periodYield?: number | null;
  dte?: number | null;
  tbill: { rate: string; as_of: string; source_url: string; kind: string } | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="yield-stack">
      <div className="rounded-control border border-hair bg-surface p-3">
        <p className="text-xs font-medium text-muted">Premium leg</p>
        <p className="mt-1 text-sm">
          {periodYield !== undefined && periodYield !== null && (
            <>
              <Pct value={periodYield} className="font-semibold" /> over <span className="num">{dte}</span> d ·{" "}
            </>
          )}
          <Pct value={premiumYieldAnn} className="font-semibold" /> annualised
        </p>
        <p className="mt-1 text-xs text-muted">for comparison with the T-bill only — not a return</p>
      </div>
      <div className="rounded-control border border-hair bg-surface p-3">
        <p className="text-xs font-medium text-muted">T-bill leg</p>
        {tbill ? (
          <p className="mt-1 text-sm">
            <Pct value={tbill.rate} className="font-semibold" /> p.a. · <span className="num">{tbill.kind}</span>
            <span className="mt-1 block text-xs text-muted">
              as of {fmtDate(tbill.as_of)} ·{" "}
              <a className="underline underline-offset-2 text-accent hover:brightness-110" href={tbill.source_url} target="_blank" rel="noreferrer">
                source
              </a>{" "}
              · only if your reserved cash actually earns it
            </span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-caution">Cite a T-bill rate first (https source) on Inputs.</p>
        )}
      </div>
    </div>
  );
}

export function TypedConfirm({
  phrase,
  onConfirm,
  label,
  busy,
  variant = "danger",
}: {
  phrase: string;
  onConfirm: () => void;
  label: string;
  busy?: boolean;
  variant?: "danger" | "primary";
}) {
  const [v, setV] = useState("");
  const id = useId();
  const ok = v.trim() === phrase;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm">
        Type <code className="num rounded bg-surface px-1.5 py-0.5 font-semibold">{phrase}</code> to confirm
      </label>
      <div className="flex flex-wrap gap-2">
        <TextInput
          id={id}
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="max-w-sm"
          autoComplete="off"
          data-testid="typed-confirm"
        />
        <Button variant={variant} disabled={!ok || busy} onClick={onConfirm} data-testid="typed-confirm-button">
          {label}
        </Button>
      </div>
    </div>
  );
}

export function StepCoach({
  steps,
  done,
  onToggle,
  busy,
}: {
  steps: { id: string; title: string; detail: ReactNode }[];
  done: string[];
  onToggle: (id: string, done: boolean) => void;
  busy?: boolean;
}) {
  return (
    <ol className="flex flex-col gap-3" data-testid="step-coach">
      {steps.map((s, i) => {
        const isDone = done.includes(s.id);
        return (
          <li
            key={s.id}
            className={cx("rounded-card border p-4 transition-colors", isDone ? "border-ok/40 bg-ok/5" : "border-hair bg-raised")}
          >
            <label className="flex min-h-11 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={isDone}
                disabled={busy}
                onChange={(e) => onToggle(s.id, e.target.checked)}
                className="mt-1 size-5 shrink-0 accent-accent"
                data-step={s.id}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-semibold text-ink">
                  <span className="num flex size-6 items-center justify-center rounded-full bg-surface text-xs text-muted">{i + 1}</span>
                  {s.title}
                </span>
                <span className="mt-1 block text-sm text-muted">{s.detail}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ol>
  );
}

export function EmptyState({ title, teach, action, art }: { title: string; teach: ReactNode; action?: ReactNode; art?: ReactNode }) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-card border border-dashed border-control/40 bg-surface/60 px-6 py-10 text-center"
      data-testid="empty-state"
    >
      {art}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="max-w-md text-sm text-muted">{teach}</p>
      {action}
    </div>
  );
}

export function ProblemAlert({
  problem,
  onRetry,
}: {
  problem: ProblemDetails | { title: string; detail?: string; traceId?: string; code?: string };
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex gap-3 rounded-control border border-loss/35 bg-loss/8 px-4 py-3 text-sm" data-testid="problem">
      <IconAlert size={16} className="mt-0.5 shrink-0 text-loss" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{problem.title}</p>
        {problem.detail && <p className="mt-0.5 text-ink/85">{problem.detail}</p>}
        <p className="num mt-1 text-xs text-muted">
          {problem.code}
          {problem.traceId ? ` · trace ${problem.traceId.slice(0, 8)}` : ""}
        </p>
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function CitationChip({ source, title, href }: { source: string; title?: string; href?: string }) {
  const inner = (
    <>
      <IconArrowRight size={11} />
      {title ?? source}
    </>
  );
  const cls =
    "inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/8 px-2 py-0.5 text-[0.72rem] font-medium text-accent";
  return href ? (
    <a href={href} className={cx(cls, "hover:underline")}>
      {inner}
    </a>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

export function MasteryMeter({
  label,
  status,
  progress,
  unlock,
}: {
  label: string;
  status: "locked" | "in_progress" | "passed";
  progress: number;
  unlock?: ReactNode;
}) {
  const tone = status === "passed" ? "bg-ok" : status === "in_progress" ? "bg-accent" : "bg-control/40";
  return (
    <div className="rounded-control border border-hair bg-raised p-3" data-competency={label}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{label}</span>
        <Badge
          tone={status === "passed" ? "ok" : status === "in_progress" ? "accent" : "neutral"}
          icon={status === "locked" ? <IconLock size={11} /> : undefined}
        >
          {status.replace("_", " ")}
        </Badge>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-hair"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label={`${label} progress`}
      >
        <div className={cx("h-full rounded-full", tone)} style={{ width: `${Math.max(4, progress * 100)}%` }} />
      </div>
      {unlock && status !== "passed" && <p className="mt-2 text-xs text-muted">{unlock}</p>}
    </div>
  );
}

export function BasisLockBanner({ basis, strike }: { basis: MoneyLike; strike: MoneyLike }) {
  return (
    <div role="alert" className="flex gap-3 rounded-control border border-loss/35 bg-loss/8 px-4 py-3 text-sm" data-testid="basis-lock">
      <IconLock size={16} className="mt-0.5 shrink-0 text-loss" />
      <p>
        Strike <MoneyText value={strike} className="font-semibold" /> is below your decision basis{" "}
        <MoneyText value={basis} className="font-semibold" />. Being called away would <strong>lock in a loss</strong>. Choose a strike at
        or above basis, or accept the locked loss explicitly on Halt / veto.
      </p>
    </div>
  );
}
