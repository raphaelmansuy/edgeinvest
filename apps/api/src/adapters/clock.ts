import type { Clock } from "../ports";

export const systemClock: Clock = { now: () => new Date() };

/** Fixed or offset clock for e2e (CLOCK_FIXED=ISO instant): time advances from that instant. */
export function fixedClock(iso: string, advancing = true): Clock {
  const t0 = new Date(iso).getTime();
  const started = Date.now();
  return { now: () => new Date(advancing ? t0 + (Date.now() - started) : t0) };
}
