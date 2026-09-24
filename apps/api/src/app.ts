// HTTP composition: middleware order matters (trace → headers → session → CSRF → auth → idempotency → routes).
import { Hono } from "hono";
import { csrf, type Env, idempotency, onError, problemResponse, securityHeaders, session, trace } from "./http";
import type { Deps } from "./ports";
import { problem } from "./problem";
import { agentRoutes } from "./routes/agent";
import { decideRoutes } from "./routes/decide";
import { executeRoutes } from "./routes/execute";
import { journalRoutes } from "./routes/journal";
import { learnRoutes } from "./routes/learn";
import { authRoutes, meRoutes } from "./routes/me";
import { simRoutes } from "./routes/sim";

const PUBLIC = [
  /^\/api\/v1\/auth\/sign-in$/,
  /^\/api\/v1\/auth\/dev-accounts$/,
  /^\/api\/v1\/me\/capabilities$/,
  /^\/api\/v1\/orders(\/.*)?$/,
];

export function createApp(d: Deps) {
  const app = new Hono<Env>();
  app.use("*", trace(), securityHeaders());
  app.onError(onError);
  app.notFound((c) => problemResponse(c, problem("NOT_FOUND")));

  app.get("/healthz", (c) => c.json({ ok: true }));
  app.get("/readyz", async (c) => {
    const db = await d.sql`select 1 as ok`.then(() => true).catch(() => false);
    const agent = await d.llm.status().catch(() => ({ available: false, model: "" }));
    return c.json({ ok: db, db, agent }, db ? 200 : 503);
  });

  const api = new Hono<Env>();
  api.use("*", session(d));
  // The no-submit guarantee, layer 4 (docs/07 §9): every /orders call is refused and audited, before any auth or CSRF.
  api.all("/orders/*", async (c) => {
    const userId = c.get("userId");
    if (userId) {
      await d.uow.run(userId, (tx) =>
        tx.audit({ action: "live_submit_attempt_blocked", actor: "user", payload: { method: c.req.method, path: c.req.path } }),
      );
    }
    throw problem("NOT_IMPLEMENTED_SUBMIT", "EdgeInvest never sends orders. You place the order yourself in IBKR.");
  });
  api.use("*", csrf(d));
  api.use("*", async (c, next) => {
    if (!c.get("userId") && !PUBLIC.some((re) => re.test(c.req.path))) throw problem("UNAUTHENTICATED");
    await next();
  });
  api.use("*", idempotency(d));

  const routes = api
    .route("/auth", authRoutes(d))
    .route("/me", meRoutes(d))
    .route("/", learnRoutes(d))
    .route("/", simRoutes(d))
    .route("/", decideRoutes(d))
    .route("/", executeRoutes(d))
    .route("/", journalRoutes(d))
    .route("/agent", agentRoutes(d));

  app.route("/api/v1", routes);
  return app;
}

export type AppType = ReturnType<typeof createApp>;
