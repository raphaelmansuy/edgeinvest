// Typed client from the Hono app type (docs/08 §6). No hand-written fetch wrappers for JSON routes.
import type { AppType } from "@edge/api/app";
import type { ProblemDetails } from "@edge/contracts";
import { hc } from "hono/client";

export class ApiProblem extends Error {
  constructor(readonly problem: ProblemDetails & { status: number; code?: string; traceId?: string; errors?: { pointer: string; message: string }[] }) {
    super(problem.title);
  }
  get status() { return this.problem.status; }
  get code() { return this.problem.code; }
}

// AppType is deeper than tsc will instantiate for hc<> (the client type collapses). Calls stay on the
// real client; response bodies are asserted in lib/queries.ts and at each mutation.
const client = hc<AppType>("/", {
  headers: () => ({ "X-CSRF": "1" }),
  init: { credentials: "same-origin" },
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any;
export const api = client.api.v1 as any;

async function toProblem(r: Response): Promise<ApiProblem> {
  const body = await r.json().catch(() => null);
  if (body && typeof body === "object" && "title" in body) return new ApiProblem({ ...(body as ProblemDetails), status: r.status });
  return new ApiProblem({ status: r.status, title: r.status === 0 ? "Network error" : `Request failed (${r.status})`, type: "about:blank", code: "NETWORK" } as never);
}

type JsonResponse = { ok: boolean; status: number; json(): Promise<unknown> } & Response;

/** Resolves the success body or throws ApiProblem (problem+json). Pass a type argument when the body is used. */
export async function unwrap<T = any>(p: Promise<JsonResponse>): Promise<T> {
  let r: JsonResponse;
  try {
    r = await p;
  } catch {
    throw new ApiProblem({ status: 0, title: "You appear to be offline", detail: "Nothing was sent. Retry when the connection is back.", type: "about:blank", code: "NETWORK" } as never);
  }
  if (!r.ok) throw await toProblem(r);
  return r.json() as T;
}

/** Raw fetch for non-JSON bodies (CSV export, SSE). Same headers as the typed client. */
export async function rawFetch(path: string, init: RequestInit & { idem?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set("X-CSRF", "1");
  if (init.idem) headers.set("Idempotency-Key", init.idem);
  const r = await fetch(`/api/v1${path}`, { credentials: "same-origin", ...init, headers });
  if (!r.ok) throw await toProblem(r);
  return r;
}

export const idem = (key: string) => ({ headers: { "Idempotency-Key": key } });
