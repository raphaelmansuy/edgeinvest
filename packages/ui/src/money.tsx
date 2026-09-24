import { formatUsd, isCentTick, parseUsd4, tryParseUsd4, type Usd4 } from "@edge/domain";
import { forwardRef, type InputHTMLAttributes } from "react";
import { cx, inputClass } from "./primitives";

export type MoneyLike = Usd4 | string | null | undefined;
export const toUsd4 = (v: MoneyLike): Usd4 | null => (v === null || v === undefined ? null : typeof v === "number" ? v : tryParseUsd4(v));

/** One formatter for all money (docs/06 §5). Accepts domain Usd4 or wire decimal strings. */
export function MoneyText({ value, sign, unit = false, className, dp }: { value: MoneyLike; sign?: boolean; unit?: boolean; className?: string; dp?: 2 | 4 }) {
  const v = toUsd4(value);
  return (
    <span className={cx("num whitespace-nowrap", className)}>
      {unit && <span className="mr-1 text-[0.8em] font-medium text-muted">USD</span>}
      {v === null ? "—" : formatUsd(v, { sign, dp })}
    </span>
  );
}

export const pct = (x: number | string | null | undefined, dp = 2) => {
  if (x === null || x === undefined || x === "") return "—";
  const n = typeof x === "string" ? Number(x) : x;
  return Number.isFinite(n) ? `${(n * 100).toFixed(dp)} %` : "—";
};
export const Pct = ({ value, dp = 2, className }: { value: number | string | null | undefined; dp?: number; className?: string }) => (
  <span className={cx("num whitespace-nowrap", className)}>{pct(value, dp)}</span>
);

export function moneyError(raw: string, opts: { tick?: boolean; positive?: boolean } = {}): string | null {
  if (!raw.trim()) return "Required";
  const v = tryParseUsd4(raw);
  if (v === null) return "Digits and a dot only, up to 4 decimals (e.g. 12.40). No commas or exponents.";
  if (opts.positive && v <= 0) return "Must be greater than 0";
  if (opts.tick && !isCentTick(v)) return "Use the 0.01 tick";
  return null;
}

/** Strict decimal input: rejects 1e3, 1,000, .5 (EC-MN-001). Emits the raw string; parse with parseUsd4. */
export const MoneyInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; unit?: string }>(
  function MoneyInput({ invalid, unit = "USD", className, ...rest }, ref) {
    return (
      <div className="relative">
        <input ref={ref} inputMode="decimal" autoComplete="off" spellCheck={false} aria-invalid={invalid || undefined}
          className={inputClass(invalid, cx("num pr-14 text-right", className))} {...rest} />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted">{unit}</span>
      </div>
    );
  });

export const parseMoney = parseUsd4;
