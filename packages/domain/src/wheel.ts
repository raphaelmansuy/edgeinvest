// Pure wheel state machine. Mirrors app.allowed_transition (DB is defense in depth).
export type CycleState = "none" | "short_put_open" | "shares_held" | "shares_short_call" | "closed";
export type WheelEvent =
  | { type: "PUT_FILLED" } | { type: "PUT_EXPIRED" } | { type: "PUT_BOUGHT_BACK" } | { type: "PUT_ROLLED" }
  | { type: "PUT_ASSIGNED" } | { type: "CALL_FILLED" } | { type: "CALL_EXPIRED" } | { type: "CALL_BOUGHT_BACK" }
  | { type: "CALL_ROLLED" } | { type: "CALLED_AWAY" } | { type: "SHARES_SOLD" };

const TABLE: Record<CycleState, Partial<Record<WheelEvent["type"], CycleState>>> = {
  none:              { PUT_FILLED: "short_put_open" },
  short_put_open:    { PUT_EXPIRED: "closed", PUT_BOUGHT_BACK: "closed", PUT_ROLLED: "short_put_open", PUT_ASSIGNED: "shares_held" },
  shares_held:       { CALL_FILLED: "shares_short_call", SHARES_SOLD: "closed" },
  shares_short_call: { CALL_EXPIRED: "shares_held", CALL_BOUGHT_BACK: "shares_held", CALL_ROLLED: "shares_short_call", CALLED_AWAY: "closed" },
  closed:            {},
};

export type Transition = { ok: true; to: CycleState } | { ok: false; error: "ILLEGAL_TRANSITION"; from: CycleState; event: WheelEvent["type"] };

export function transition(from: CycleState, event: WheelEvent): Transition {
  const to = TABLE[from][event.type];
  return to ? { ok: true, to } : { ok: false, error: "ILLEGAL_TRANSITION", from, event: event.type };
}

export const phaseOf = (s: CycleState) => (s === "shares_held" || s === "shares_short_call" ? "shares-held" : "cash-put");
export const LEGAL_EDGES = Object.entries(TABLE).flatMap(([from, evs]) =>
  Object.values(evs).map((to) => [from as CycleState, to as CycleState] as const));
