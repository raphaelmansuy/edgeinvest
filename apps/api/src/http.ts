// Cross-cutting HTTP adapters: trace, headers, problem mapping, session, CSRF, idempotency, rate limits (docs/07 §8, §10).
import { zValidator } from "@hono/zod-validator";
import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type * as z from "zod";
import { sha256, sha256hex } from "./adapters/pg";
import type { Deps } from "./ports";
import { Problem, fromDbError, problem } from "./problem";

export type Env = { Variables: { traceId: string; userId: string | null; sessionHash: Buffer | null } };
/** `__Host-sid` requires Secure; local `make dev` uses plain `sid` when INSECURE_COOKIES=1. */
export const SESSION_COOKIE = process.env.INSECURE_COOKIES === "1" ? "sid" : "__Host-sid";

export const trace = (): MiddlewareHandler<Env> => async (c, next) => {
  const traceId = crypto.randomUUID();
  c.set("traceId", traceId);
  const t0 = performance.now();
  await next();
  c.header("X-Trace-Id", traceId);
  if (process.env.LOG_REQUESTS !== "0") {
    const uid = c.get("userId");
    console.log(JSON.stringify({ traceId, method: c.req.method, path: c.req.path, status: c.res.status,
      ms: Math.round(performance.now() - t0), user: uid ? sha256hex(uid).slice(0, 12) : null }));
  }
};

export const securityHeaders = (): MiddlewareHandler<Env> => async (c, next) => {
  await next();
  c.header("Content-Security-Policy", "default-src 'self'; connect-src 'self'; frame-ancestors 'none'");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "same-origin");
  c.header("Cache-Control", "no-store");
};

export function problemResponse(c: Context<Env>, p: Problem) {
  if (p.extra.retryAfter) c.header("Retry-After", String(p.extra.retryAfter));
  return c.json(p.toJSON(c.get("traceId")), p.status as 400, { "Content-Type": "application/problem+json" });
}

export function onError(err: Error, c: Context<Env>) {
  const p = err instanceof Problem ? err : fromDbError(err);
  if (p) return problemResponse(c, p);
  console.error(JSON.stringify({ traceId: c.get("traceId"), error: err.message, stack: err.stack?.split("\n").slice(0, 4) }));
  return problemResponse(c, problem("INTERNAL"));
}

/** zValidator that fails with our problem+json (field pointers) instead of Hono's default 400 body. */
export const body = <S extends z.ZodType>(schema: S) =>
  zValidator("json", schema, (r) => {
    if (!r.success) {
      const errors = r.error.issues.map((i) => ({ pointer: `/${i.path.join("/")}`, message: i.message }));
      throw problem(errors.length ? "VALIDATION_FAILED" : "MALFORMED_REQUEST", errors[0]?.message, { errors });
    }
  });
export const query = <S extends z.ZodType>(schema: S) =>
  zValidator("query", schema, (r) => {
    if (!r.success) throw problem("VALIDATION_FAILED", r.error.issues[0]?.message);
  });

const IDLE_MS = 7 * 86_400_000;
export const session = (d: Deps): MiddlewareHandler<Env> => async (c, next) => {
  c.set("userId", null);
  c.set("sessionHash", null);
  const token = getCookie(c, SESSION_COOKIE);
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    const hash = sha256(token);
    const [row] = await d.sql`select app.session_resolve(${hash}) as user_id`;
    if (row?.user_id) {
      const ok = await d.uow.run(row.user_id, async (tx) => {
        const [s] = await tx.sql`select last_seen_at from app.session where token_sha256 = ${hash}`;
        if (!s || d.clock.now().getTime() - new Date(s.last_seen_at).getTime() > IDLE_MS) return false;
        if (Date.now() - new Date(s.last_seen_at).getTime() > 300_000) {
          await tx.sql`update app.session set last_seen_at = now() where token_sha256 = ${hash}`;
        }
        return true;
      });
      if (ok) {
        c.set("userId", row.user_id);
        c.set("sessionHash", hash);
      }
    }
  }
  await next();
};

export const requireUser = (): MiddlewareHandler<Env> => async (c, next) => {
  if (!c.get("userId")) throw problem("UNAUTHENTICATED");
  await next();
};
export const uid = (c: Context<Env>) => {
  const u = c.get("userId");
  if (!u) throw problem("UNAUTHENTICATED");
  return u;
};

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const csrf = (d: Deps): MiddlewareHandler<Env> => async (c, next) => {
  if (MUTATING.has(c.req.method)) {
    const origin = c.req.header("Origin");
    const host = c.req.header("Host");
    const sameHost = origin && host && (origin === `http://${host}` || origin === `https://${host}`);
    if (c.req.header("X-CSRF") !== "1" || !origin || !(sameHost || d.config.allowedOrigins.includes(origin))) {
      throw problem("CSRF_FAILED", "Mutations need the X-CSRF header and an allowed Origin.");
    }
  }
  await next();
};

/** Idempotency-Key on authenticated mutations (docs/07 §8.2): replay, in-progress, mismatch. */
export const idempotency = (d: Deps): MiddlewareHandler<Env> => async (c, next) => {
  const userId = c.get("userId");
  if (!MUTATING.has(c.req.method) || !userId) return next();
  const key = c.req.header("Idempotency-Key");
  if (!key) throw problem("MALFORMED_REQUEST", "Idempotency-Key header is required on mutations.");
  if (key.length < 8 || key.length > 128) throw problem("MALFORMED_REQUEST", "Idempotency-Key must be 8–128 characters.");
  const raw = c.req.header("Content-Type")?.includes("json") ? await c.req.text() : "";
  const reqHash = sha256(`${c.req.method} ${c.req.path}\n${raw}`);
  const claimed = await d.uow.run(userId, async (tx) => {
    const ins = await tx.sql`insert into app.idempotency_key (user_id, key, request_hash) values (${userId}, ${key}, ${reqHash})
                             on conflict do nothing returning key`;
    if (ins.length) return { fresh: true as const };
    const [row] = await tx.sql`select request_hash, status_code, response from app.idempotency_key where user_id = ${userId} and key = ${key}`;
    return { fresh: false as const, row };
  });
  if (!claimed.fresh) {
    const row = claimed.row as { request_hash: Buffer; status_code: number | null; response: unknown };
    if (!row.request_hash.equals(reqHash)) throw problem("IDEMPOTENCY_MISMATCH");
    if (row.status_code === null) throw problem("IDEMPOTENCY_IN_PROGRESS", undefined, { retryAfter: 1 });
    c.header("Idempotent-Replayed", "true");
    return c.json(row.response as object, row.status_code as 200);
  }
  try {
    await next();
  } catch (e) {
    const p = e instanceof Problem ? e : fromDbError(e);
    if (p && p.status < 500) {
      await store(p.status, p.toJSON(c.get("traceId")));
    } else {
      await d.uow.run(userId, (tx) => tx.sql`delete from app.idempotency_key where user_id = ${userId} and key = ${key}`);
    }
    throw e;
  }
  const res = c.res;
  if (res.status >= 500 || !res.headers.get("Content-Type")?.includes("json")) {
    await d.uow.run(userId, (tx) => tx.sql`delete from app.idempotency_key where user_id = ${userId} and key = ${key}`);
    return;
  }
  const json = await res.clone().json().catch(() => null);
  await store(res.status, json);

  async function store(status: number, response: unknown) {
    await d.uow.run(userId!, (tx) =>
      tx.sql`update app.idempotency_key set status_code = ${status}, response = ${response as object} where user_id = ${userId} and key = ${key}`);
  }
};

/** Fixed-window in-memory limiter (single API process in MVP). */
export function rateLimit(name: string, max: number, windowMs: number, keyOf: (c: Context<Env>) => string): MiddlewareHandler<Env> {
  const hits = new Map<string, { n: number; reset: number }>();
  return async (c, next) => {
    if (process.env.RATE_LIMITS === "off") return next();
    const k = `${name}:${keyOf(c)}`;
    const now = Date.now();
    const h = hits.get(k);
    if (!h || h.reset < now) hits.set(k, { n: 1, reset: now + windowMs });
    else if (++h.n > max) {
      const retry = Math.ceil((h.reset - now) / 1000);
      throw problem("RATE_LIMITED", `Too many attempts. Try again in ${Math.ceil(retry / 60)} min.`, { retryAfter: retry });
    }
    await next();
  };
}
export const clientIp = (c: Context<Env>) => c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ?? "local";
