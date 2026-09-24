export type EnvelopeId = "beginner_v1" | "mentor_cyrille_v1";

export interface Envelope {
  id: EnvelopeId;
  otmMin: number; otmMax: number;   // fraction of spot, e.g. 0.05
  dteMin: number; dteMax: number;
  lotsMax: 1;                       // willingness default — never floor(cash / (K × 100))
  requiresMastery: boolean;
}

export const ENVELOPES: Readonly<Record<EnvelopeId, Envelope>> = Object.freeze({
  beginner_v1:       { id: "beginner_v1",       otmMin: 0.05, otmMax: 0.12, dteMin: 60, dteMax: 120, lotsMax: 1, requiresMastery: false },
  mentor_cyrille_v1: { id: "mentor_cyrille_v1", otmMin: 0.16, otmMax: 0.30, dteMin: 60, dteMax: 120, lotsMax: 1, requiresMastery: true },
});

/** Distance out of the money as a fraction of spot. Put: (S−K)/S. Call: (K−S)/S. Negative ⇒ ITM. */
export function otmFraction(putCall: "P" | "C", spot: number, strike: number): number {
  if (spot <= 0) throw new RangeError("SPOT_NOT_POSITIVE");
  return putCall === "P" ? (spot - strike) / spot : (strike - spot) / spot;
}

const EPS = 1e-9; // band edges are inclusive; guard against float noise at exactly 5% / 12%
export const inBand = (x: number, min: number, max: number) => x >= min - EPS && x <= max + EPS;
