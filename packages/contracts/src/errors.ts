// Error catalogue (docs/07 §8.1): the only place HTTP status ↔ stable code is defined.
export const ERRORS = {
  MALFORMED_REQUEST: { status: 400, title: "The request could not be read" },
  VALIDATION_FAILED: { status: 422, title: "Some fields need attention" },
  UNAUTHENTICATED: { status: 401, title: "Please sign in" },
  INVALID_CREDENTIALS: { status: 401, title: "Email or password is wrong" },
  CSRF_FAILED: { status: 403, title: "Request blocked by the CSRF check" },
  CAPABILITY_MISSING: { status: 403, title: "This step is locked" },
  NOT_FOUND: { status: 404, title: "Not found" },
  UNKNOWN_SCENARIO: { status: 404, title: "Unknown crash scenario" },
  ILLEGAL_TRANSITION: { status: 409, title: "That step is not allowed from the current state" },
  STALE_WRITE: { status: 409, title: "This changed in another tab" },
  IDEMPOTENCY_MISMATCH: { status: 409, title: "Idempotency key reused with a different request" },
  IDEMPOTENCY_IN_PROGRESS: { status: 409, title: "The same request is still running" },
  MEMO_FROZEN: { status: 409, title: "The memo is frozen once a draft exists" },
  CHAIN_STALE: { status: 409, title: "Quotes are stale" },
  HALT_ACTIVE: { status: 409, title: "The account is halted" },
  LOTS_EXCEEDED: { status: 409, title: "One lot at a time" },
  HALT_CONDITION_PERSISTS: { status: 409, title: "The halt condition is still true" },
  STRESS_MISMATCH: { status: 409, title: "Stress result does not match this memo" },
  PHASE_MISMATCH: { status: 422, title: "Not available in your current phase" },
  EMPTY_CHAIN: { status: 422, title: "No quote, refusing to invent one" },
  NON_STANDARD_DELIVERABLE: { status: 422, title: "Non-standard deliverable refused" },
  OFF_TICK: { status: 422, title: "Price is not on the 0.01 tick" },
  RATE_NOT_CITED: { status: 422, title: "Cite a T-bill rate first" },
  RATE_LIMITED: { status: 429, title: "Too many attempts" },
  NOT_IMPLEMENTED_SUBMIT: { status: 501, title: "This app never sends orders" },
  AGENT_UNAVAILABLE: { status: 503, title: "Agent offline. All safety checks still run." },
  SIM_TIMEOUT: { status: 503, title: "Simulation took too long. Try fewer paths." },
  INTERNAL: { status: 500, title: "Something failed on our side. Nothing was sent to any broker." },
} as const satisfies Record<string, { status: number; title: string }>;

export type ErrorCode = keyof typeof ERRORS;

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: ErrorCode;
  detail?: string;
  traceId?: string;
  errors?: { pointer: string; message: string }[];
  retryAfter?: number;
}

export const problemType = (code: ErrorCode) => `https://edgeinvest.local/problems/${code.toLowerCase().replaceAll("_", "-")}`;

export const isProblem = (x: unknown): x is ProblemDetails =>
  typeof x === "object" && x !== null && "code" in x && "status" in x && typeof (x as { code: unknown }).code === "string";
