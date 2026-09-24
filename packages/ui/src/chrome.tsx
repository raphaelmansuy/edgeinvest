import type { Banner } from "@edge/contracts";
import { APPROVED, COPY_VERSION, HALT_TEXT } from "@edge/copy";
import { ENVELOPES, type EnvelopeId, type Phase } from "@edge/domain";
import { Fragment, type ReactNode, useState } from "react";
import { IconAlert, IconChevronDown, IconHalt, IconShield, IconWheel } from "./icons";
import { type MoneyLike, MoneyText, toUsd4 } from "./money";
import { Badge, cx } from "./primitives";

/** Renders approved copy with **emphasis** and `code` markers (docs/12 §2). */
export function CopyText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.startsWith("**") ? (
          <strong key={i} className="font-semibold">
            {p.slice(2, -2)}
          </strong>
        ) : p.startsWith("`") ? (
          <code key={i} className="num rounded bg-surface px-1 text-[0.9em]">
            {p.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5 font-semibold tracking-tight text-ink", className)}>
      <span className="font-display text-[1.05em] leading-none">EdgeInvest</span>
      <span className="mt-0.5 h-[2px] w-7 shrink-0 bg-accent" aria-hidden />
    </span>
  );
}

export function PhaseChip({ phase }: { phase: Phase }) {
  const shares = phase === "shares-held";
  return (
    <span
      role="status"
      className={cx(
        "inline-flex items-center gap-1.5 rounded-control border px-2 py-1 text-xs font-semibold",
        shares ? "border-caution/40 bg-caution/10 text-caution" : "border-accent/35 bg-accent/8 text-accent",
      )}
      aria-label={`Phase: ${phase}`}
      data-testid="phase-chip"
    >
      <IconWheel size={14} />
      {shares ? "Shares held" : "Cash put"}
    </span>
  );
}

export function LotsMeter({ open, max }: { open: number; max: number }) {
  const full = open >= max;
  return (
    <span
      role="status"
      className={cx("inline-flex items-center gap-2 text-xs font-medium", full ? "text-caution" : "text-muted")}
      aria-label={`Lots ${open} of ${max}${full ? ", at limit" : ""}`}
    >
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={cx("h-3 w-2 rounded-sm", i < open ? (full ? "bg-caution" : "bg-accent") : "bg-hair")} />
        ))}
      </span>
      <span className="num">
        Lots {open}/{max}
      </span>
      {full && <span>at limit</span>}
    </span>
  );
}

export function ReservedLeftoverBar({ reserved, leftover, compact }: { reserved: MoneyLike; leftover: MoneyLike; compact?: boolean }) {
  const r = Math.max(0, toUsd4(reserved) ?? 0);
  const l = Math.max(0, toUsd4(leftover) ?? 0);
  const total = r + l || 1;
  return (
    <span className={cx("inline-flex items-center gap-2 text-xs", compact ? "" : "min-w-64")}>
      <span className="text-muted">Reserved</span>
      <MoneyText value={reserved} className="font-semibold text-ink" />
      <span className="relative h-2 w-24 overflow-hidden rounded-full bg-ok/20" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${(r / total) * 100}%` }} />
      </span>
      <span className="text-muted">Leftover</span>
      <MoneyText value={leftover} className="font-semibold text-ink" />
      <span className="text-muted">USD</span>
    </span>
  );
}

export function EnvelopeBadge({ envelopeId, override }: { envelopeId: EnvelopeId; override?: boolean }) {
  const e = ENVELOPES[envelopeId];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span>Env:</span>
      <span className="font-semibold text-ink">{e.label}</span>
      <span className="num">
        {Math.round(e.otmMin * 100)}–{Math.round(e.otmMax * 100)} %
      </span>
      {envelopeId === "beginner_v1" && <Badge tone="neutral">Default</Badge>}
      {override && <Badge tone="caution">override</Badge>}
    </span>
  );
}

export function ModeChip({ mode }: { mode: "paper" | "live" }) {
  return mode === "live" ? (
    <span
      className="inline-flex items-center gap-1.5 rounded-control bg-loss px-2 py-1 text-xs font-semibold text-white dark:text-bg"
      data-testid="mode-chip"
    >
      <span className="size-1.5 rounded-full bg-white dark:bg-bg" aria-hidden />
      Live · real money
    </span>
  ) : (
    <span
      className="inline-flex items-center rounded-control border border-control/50 bg-surface px-2 py-1 text-xs font-medium text-muted"
      data-testid="mode-chip"
    >
      Paper
    </span>
  );
}

export function HaltBanner({ reason, action }: { reason: string; action?: ReactNode }) {
  const t = HALT_TEXT[reason];
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-slide-down flex flex-wrap items-center gap-3 rounded-control border border-loss/40 bg-loss/10 px-4 py-2.5 text-sm text-ink"
    >
      <IconHalt size={18} className="shrink-0 text-loss" />
      <span className="font-semibold text-loss">Halt</span>
      <span className="num text-xs text-muted">{reason}</span>
      <span className="min-w-0 flex-1">{t?.title ?? "Account halted"}.</span>
      {action}
    </div>
  );
}

export function PaperBar() {
  return (
    <div
      className="flex items-center justify-center gap-2 rounded-control border border-dashed border-control/70 bg-surface py-1.5 text-xs font-medium text-muted"
      data-testid="paper-bar"
    >
      {APPROVED["paper.bar"]}
    </div>
  );
}

/** Registry-driven banner (docs/12 §4): sticky may collapse to one line per session; required never collapses. */
export function ComplianceBanner({ banner, extra, detailsHref }: { banner: Banner; extra?: ReactNode; detailsHref?: string }) {
  const required = banner === "required" || banner === "required_live";
  const [collapsed, setCollapsed] = useState(
    () => !required && typeof sessionStorage !== "undefined" && sessionStorage.getItem("edge.banner") === "1",
  );
  const isCollapsed = collapsed && !required;
  return (
    <aside
      role="note"
      aria-label="Compliance"
      data-testid="compliance-banner"
      data-banner={banner}
      className="border-t border-caution/25 bg-banner text-ink"
    >
      <div className={cx("mx-auto flex max-w-[1400px] items-start gap-3 px-4 sm:px-6", isCollapsed ? "py-1.5" : "py-2.5")}>
        <IconShield size={16} className="mt-0.5 shrink-0 text-caution" />
        <div className={cx("min-w-0 flex-1 text-xs leading-relaxed", isCollapsed && "truncate")}>
          <CopyText text={APPROVED["edu.sticky"]} />
          {!isCollapsed && extra && <div className="mt-1">{extra}</div>}
        </div>
        <span className="num hidden shrink-0 text-[0.7rem] text-muted sm:inline">copy {COPY_VERSION}</span>
        {detailsHref && (
          <a href={detailsHref} className="shrink-0 text-xs font-medium text-accent hover:underline">
            details
          </a>
        )}
        {!required && (
          <button
            type="button"
            className="shrink-0 text-muted hover:text-ink"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Expand compliance banner" : "Collapse compliance banner to one line"}
            onClick={() => {
              const next = !collapsed;
              setCollapsed(next);
              sessionStorage.setItem("edge.banner", next ? "1" : "0");
            }}
          >
            <IconChevronDown size={16} className={cx("transition-transform", isCollapsed ? "" : "rotate-180")} />
          </button>
        )}
      </div>
    </aside>
  );
}

export function InlineNotice({
  tone = "caution",
  title,
  children,
  icon,
}: {
  tone?: "caution" | "loss" | "accent" | "ok";
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  const c = {
    caution: "border-caution/35 bg-caution/8 [&_svg]:text-caution",
    loss: "border-loss/35 bg-loss/8 [&_svg]:text-loss",
    accent: "border-accent/30 bg-accent/6 [&_svg]:text-accent",
    ok: "border-ok/30 bg-ok/8 [&_svg]:text-ok",
  }[tone];
  return (
    <div className={cx("flex gap-3 rounded-control border px-4 py-3 text-sm", c)}>
      <span className="mt-0.5 shrink-0">{icon ?? <IconAlert size={16} />}</span>
      <div className="min-w-0">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children && <div className={cx("text-ink/85", title ? "mt-0.5" : null)}>{children}</div>}
      </div>
    </div>
  );
}
