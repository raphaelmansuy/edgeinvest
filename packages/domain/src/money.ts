// Exact USD arithmetic: integer count of 1/10,000 USD, mirroring NUMERIC(18,4) in Postgres (ADR-008).
// Floats never touch money; ratios (OTM %, yields) may be floats.
declare const usd4Brand: unique symbol;
export type Usd4 = number & { readonly [usd4Brand]: true };

export const SCALE = 10_000;
export const MONEY_PATTERN = /^(-)?(\d{1,14})(?:\.(\d{1,4}))?$/;

export function parseUsd4(input: string): Usd4 {
  const m = MONEY_PATTERN.exec(input.trim());
  if (!m) throw new RangeError(`INVALID_MONEY: "${input}"`);
  const [, sign, whole, frac = ""] = m;
  const units = Number(whole) * SCALE + Number(frac.padEnd(4, "0"));
  return usd4(sign ? -units : units);
}

export const tryParseUsd4 = (input: string): Usd4 | null => {
  try {
    return parseUsd4(input);
  } catch {
    return null;
  }
};

export function usd4(units: number): Usd4 {
  if (!Number.isSafeInteger(units)) throw new RangeError(`UNSAFE_MONEY: ${units}`);
  return (units === 0 ? 0 : units) as Usd4; // normalise -0
}

/** From a float dollar amount (simulation boundary only): rounds to the nearest 1/10,000. */
export const fromDollars = (d: number): Usd4 => usd4(Math.round(d * SCALE));
export const toDollars = (v: Usd4): number => v / SCALE;

export const ZERO = usd4(0);
export const add = (a: Usd4, b: Usd4) => usd4(a + b);
export const sub = (a: Usd4, b: Usd4) => usd4(a - b);
export const neg = (a: Usd4) => usd4(-a);
export const sum = (xs: readonly Usd4[]) => xs.reduce(add, ZERO);
export const times = (a: Usd4, k: number) => {
  if (!Number.isInteger(k)) throw new RangeError("MONEY_TIMES_NON_INTEGER");
  return usd4(a * k);
};
/** Division that rounds half away from zero to 1/10,000 (used for per-share basis). */
export const divRound = (a: Usd4, k: number) => {
  if (!Number.isInteger(k) || k === 0) throw new RangeError("MONEY_DIV_INVALID");
  const q = a / k;
  return usd4(q < 0 ? -Math.round(-q) : Math.round(q));
};

export function toDecimalString(v: Usd4): string {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  return `${sign}${Math.trunc(abs / SCALE)}.${String(abs % SCALE).padStart(4, "0")}`;
}

/** Display: 2 decimals, thin grouping, optional sign. Single formatter for all money (DRY, 02 §11). */
export function formatUsd(v: Usd4, opts: { sign?: boolean; dp?: 2 | 4 } = {}): string {
  const dp = opts.dp ?? 2;
  const abs = Math.abs(v);
  const cents = dp === 2 ? Math.round(abs / 100) : abs;
  const unit = dp === 2 ? 100 : SCALE;
  const whole = Math.trunc(cents / unit).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = String(cents % unit).padStart(dp, "0");
  const sign = v < 0 ? "−" : opts.sign && v > 0 ? "+" : "";
  return `${sign}${whole}.${frac}`;
}

/** US equity options quote in whole cents (QQQ is penny-increment). */
export const isCentTick = (price: Usd4) => price % 100 === 0;
