export type EnvelopeId = "beginner_v1" | "mentor_cyrille_v1";
export const ENVELOPE_IDS = ["beginner_v1", "mentor_cyrille_v1"] as const satisfies readonly EnvelopeId[];

export interface Envelope {
  id: EnvelopeId;
  label: string;
  otmMin: number;
  otmMax: number; // fraction of spot, e.g. 0.05
  dteMin: number;
  dteMax: number;
  lotsMax: 1; // willingness default — never floor(cash / (K × 100))
  requiresMastery: boolean;
}

export const ENVELOPES: Readonly<Record<EnvelopeId, Envelope>> = Object.freeze({
  beginner_v1: {
    id: "beginner_v1",
    label: "Beginner",
    otmMin: 0.05,
    otmMax: 0.12,
    dteMin: 60,
    dteMax: 120,
    lotsMax: 1,
    requiresMastery: false,
  },
  mentor_cyrille_v1: {
    id: "mentor_cyrille_v1",
    label: "Mentor",
    otmMin: 0.16,
    otmMax: 0.3,
    dteMin: 60,
    dteMax: 120,
    lotsMax: 1,
    requiresMastery: true,
  },
});

export const DEFAULT_ENVELOPE: EnvelopeId = "beginner_v1";

/** Canonical parameter string hashed at boot and compared with envelope.params_sha256 (EC-EN-004). */
export const envelopeParamsCanonical = (e: Envelope) =>
  JSON.stringify({ dte_max: e.dteMax, dte_min: e.dteMin, lots_max: e.lotsMax, otm_max: e.otmMax, otm_min: e.otmMin, requires_mastery: e.requiresMastery });

/** Distance out of the money as a fraction of spot. Put: (S−K)/S. Call: (K−S)/S. Negative ⇒ ITM. */
export function otmFraction(putCall: "P" | "C", spot: number, strike: number): number {
  if (spot <= 0) throw new RangeError("SPOT_NOT_POSITIVE");
  return putCall === "P" ? (spot - strike) / spot : (strike - spot) / spot;
}

const EPS = 1e-9; // band edges are inclusive; guard against float noise at exactly 5% / 12%
export const inBand = (x: number, min: number, max: number) => x >= min - EPS && x <= max + EPS;
