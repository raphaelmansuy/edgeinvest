// Listed US options expire on the US/Eastern calendar. A Hong Kong user at 07:00 HKT is still on
// "yesterday" in New York, so DTE must be computed on the exchange calendar (EC-TM-001).
const ET = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
});

export const exchangeDate = (now: Date): string => ET.format(now); // "YYYY-MM-DD"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const dayNumber = (isoDate: string) => {
  if (!ISO_DATE.test(isoDate)) throw new RangeError(`INVALID_DATE: ${isoDate}`);
  return Date.UTC(+isoDate.slice(0, 4), +isoDate.slice(5, 7) - 1, +isoDate.slice(8, 10)) / 86_400_000;
};

export function daysToExpiry(expiry: string, now: Date): number {
  return dayNumber(expiry) - dayNumber(exchangeDate(now));
}
