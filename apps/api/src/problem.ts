import { ERRORS, type ErrorCode, type ProblemDetails, problemType } from "@edge/contracts";

/** Typed application error; the HTTP adapter maps it to RFC 9457 problem+json (docs/07 §8.1). */
export class Problem extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly detail?: string,
    readonly extra: Partial<Pick<ProblemDetails, "errors" | "retryAfter">> & Record<string, unknown> = {},
  ) {
    super(`${code}${detail ? `: ${detail}` : ""}`);
  }
  get status() {
    return ERRORS[this.code].status;
  }
  toJSON(traceId?: string): ProblemDetails & Record<string, unknown> {
    return { type: problemType(this.code), title: ERRORS[this.code].title, status: this.status, code: this.code,
      ...(this.detail ? { detail: this.detail } : {}), ...this.extra, ...(traceId ? { traceId } : {}) };
  }
}

export const problem = (code: ErrorCode, detail?: string, extra?: Problem["extra"]) => new Problem(code, detail, extra);

/** DB triggers raise `CODE: detail` messages; map known prefixes back to catalogue codes (docs/07 §8.1). */
const DB_PREFIXES: ErrorCode[] = ["ILLEGAL_TRANSITION", "LOTS_EXCEEDED", "HALT_ACTIVE"];
export function fromDbError(e: unknown): Problem | null {
  const msg = e instanceof Error ? e.message : String(e);
  for (const code of DB_PREFIXES) if (msg.includes(`${code}:`) || msg.startsWith(code)) return problem(code, msg.slice(msg.indexOf(code)));
  const errno = (e as { errno?: string; code?: string })?.errno ?? (e as { code?: string })?.code;
  if (errno === "23514" || /violates check constraint/.test(msg)) return problem("VALIDATION_FAILED", msg.replace(/^.*?violates/, "violates"));
  if (errno === "22P02" || /invalid input syntax for type uuid/.test(msg)) return problem("NOT_FOUND");
  return null;
}
