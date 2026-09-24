// Listed US options expire on the US/Eastern calendar. A Hong Kong user at 07:00 HKT is still on
// "yesterday" in New York, so DTE must be computed on the exchange calendar (EC-TM-001).
const ET = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const ET_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour12: false,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export const exchangeDate = (now: Date): string => ET.format(now); // "YYYY-MM-DD"

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const dayNumber = (isoDate: string) => {
  if (!ISO_DATE.test(isoDate)) throw new RangeError(`INVALID_DATE: ${isoDate}`);
  return Date.UTC(+isoDate.slice(0, 4), +isoDate.slice(5, 7) - 1, +isoDate.slice(8, 10)) / 86_400_000;
};

export function daysToExpiry(expiry: string, now: Date): number {
  return dayNumber(expiry) - dayNumber(exchangeDate(now));
}

export const addDays = (isoDate: string, n: number): string =>
  new Date((dayNumber(isoDate) + n) * 86_400_000).toISOString().slice(0, 10);

/** NYSE full-day closures used only for staleness (expiries come from captured quotes, EC-TM-003). */
export const NYSE_HOLIDAYS = new Set([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03",
  "2026-09-07", "2026-11-26", "2026-12-25", "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26",
  "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

/** Regular trading session (09:30–16:00 ET, weekdays, not a holiday). DST is handled by the ET zone (EC-TM-002). */
export function isRegularSession(now: Date): boolean {
  const parts = Object.fromEntries(ET_PARTS.formatToParts(now).map((p) => [p.type, p.value]));
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return false;
  if (NYSE_HOLIDAYS.has(exchangeDate(now))) return false;
  const minutes = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

/** Most recent session close (16:00 ET) at or before now. */
export function lastSessionClose(now: Date): Date {
  let d = exchangeDate(now);
  for (let i = 0; i < 10; i++) {
    const close = etWallClock(d, 16, 0);
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6 && !NYSE_HOLIDAYS.has(d) && close <= now) return close;
    d = addDays(d, -1);
  }
  return now;
}

/** Converts an ET wall-clock time on an ISO date to an instant (handles DST by probing the offset). */
export function etWallClock(isoDate: string, hour: number, minute: number): Date {
  const guess = new Date(`${isoDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
  const shown = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour12: false, hour: "2-digit", minute: "2-digit",
  }).formatToParts(guess);
  const h = Number(shown.find((p) => p.type === "hour")?.value) % 24;
  const m = Number(shown.find((p) => p.type === "minute")?.value);
  const offsetMin = (h * 60 + m) - (hour * 60 + minute);
  const wrapped = offsetMin > 720 ? offsetMin - 1440 : offsetMin < -720 ? offsetMin + 1440 : offsetMin;
  return new Date(guess.getTime() - wrapped * 60_000);
}

export const STALE_MINUTES_IN_SESSION = 15;

/** A quote is stale if older than 15 min during the session, or older than the last close outside it (EC-MD-002). */
export function quoteIsStale(asOf: Date, now: Date): boolean {
  if (isRegularSession(now)) return now.getTime() - asOf.getTime() > STALE_MINUTES_IN_SESSION * 60_000;
  return asOf.getTime() < lastSessionClose(now).getTime() - STALE_MINUTES_IN_SESSION * 60_000;
}

export const ACCOUNT_SNAPSHOT_MAX_AGE_H = 24;
export const accountSnapshotIsStale = (asOf: Date, now: Date) =>
  now.getTime() - asOf.getTime() > ACCOUNT_SNAPSHOT_MAX_AGE_H * 3_600_000;

/** HK year of assessment (1 Apr – 31 Mar), mirrors the DB generated column (EC-LG-003). */
export function hkYearOfAssessment(isoDate: string): string {
  const y = +isoDate.slice(0, 4);
  const m = +isoDate.slice(5, 7);
  const start = m >= 4 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}
export const quarterLabel = (isoDate: string) => `${isoDate.slice(0, 4)}-Q${Math.ceil(+isoDate.slice(5, 7) / 3)}`;
