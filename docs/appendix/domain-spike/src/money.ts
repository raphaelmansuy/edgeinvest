// Exact USD arithmetic: integer count of 1/10,000 USD, mirroring NUMERIC(18,4) in Postgres.
// Floats never touch money; ratios (OTM %, yields) may be floats.
declare const usd4Brand: unique symbol;
export type Usd4 = number & { readonly [usd4Brand]: true };

const SCALE = 10_000;
const DECIMAL = /^(-)?(\d{1,14})(?:\.(\d{1,4}))?$/;

export function parseUsd4(input: string): Usd4 {
  const m = DECIMAL.exec(input.trim());
  if (!m) throw new RangeError(`INVALID_MONEY: "${input}"`);
  const [, sign, whole, frac = ""] = m;
  const units = Number(whole) * SCALE + Number(frac.padEnd(4, "0"));
  return usd4(sign ? -units : units);
}

export function usd4(units: number): Usd4 {
  if (!Number.isSafeInteger(units)) throw new RangeError(`UNSAFE_MONEY: ${units}`);
  return (units === 0 ? 0 : units) as Usd4; // normalise -0
}

export const add = (a: Usd4, b: Usd4) => usd4(a + b);
export const sub = (a: Usd4, b: Usd4) => usd4(a - b);
export const times = (a: Usd4, k: number) => {
  if (!Number.isInteger(k)) throw new RangeError("MONEY_TIMES_NON_INTEGER");
  return usd4(a * k);
};

export function toDecimalString(v: Usd4): string {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  return `${sign}${Math.trunc(abs / SCALE)}.${String(abs % SCALE).padStart(4, "0")}`;
}

/** US equity options quote in whole cents (QQQ is penny-increment). */
export const isCentTick = (price: Usd4) => price % 100 === 0;
