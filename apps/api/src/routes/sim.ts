import { BacktestReq, CrashReq, InvariantsReq, McReq, PayoffReq } from "@edge/contracts";
import { CRASH_SCENARIOS, DATASET_VERSION } from "@edge/sim";
import { Hono } from "hono";
import * as z from "zod";
import { type Env, body, query, rateLimit, uid } from "../http";
import type { Deps } from "../ports";
import * as sim from "../usecases/sim";

export const simRoutes = (d: Deps) =>
  new Hono<Env>()
    .post("/calc/invariants", body(InvariantsReq), (c) => c.json(sim.calcInvariants(c.req.valid("json"))))
    .post("/sim/payoff", body(PayoffReq), (c) => c.json(sim.payoff(c.req.valid("json"))))
    .get("/sim/scenarios", (c) => c.json({
      dataset: DATASET_VERSION,
      crashes: Object.values(CRASH_SCENARIOS).map(({ id, title, start, end, narrative }) => ({ id, title, start, end, narrative })),
    }))
    .post("/sim/crash", rateLimit("sim", 60, 60_000, (c) => uid(c)), body(CrashReq), async (c) =>
      c.json(await d.uow.run(uid(c), (tx) => sim.runCrash(d, tx, c.req.valid("json"))), 201))
    .post("/sim/mc", rateLimit("sim", 60, 60_000, (c) => uid(c)), body(McReq), async (c) =>
      c.json(await d.uow.run(uid(c), (tx) => sim.runMc(d, tx, c.req.valid("json"))), 201))
    .post("/sim/backtest", body(BacktestReq), async (c) =>
      c.json(await d.uow.run(uid(c), (tx) => sim.queueBacktest(tx, c.req.valid("json"))), 202))
    .get("/sim/results", query(z.object({ kind: z.enum(["crash", "mc", "backtest"]).optional() })), async (c) =>
      c.json(await d.uow.run(uid(c), (tx) => sim.listResults(tx, c.req.valid("query").kind))))
    .get("/sim/results/:id", async (c) => c.json(await d.uow.run(uid(c), (tx) => sim.getResult(tx, c.req.param("id")))))
    .get("/jobs/:id", async (c) => c.json(await d.uow.run(uid(c), (tx) => sim.getJob(tx, c.req.param("id")))));
