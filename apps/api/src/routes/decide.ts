import { AccountSnapshotReq, AttachStressReq, CreateMemoReq, DecideReq, MarketSnapshotReq, RateReq, SkipReq } from "@edge/contracts";
import { Hono } from "hono";
import * as z from "zod";
import { type Env, body, query, uid } from "../http";
import type { Deps } from "../ports";
import * as decide from "../usecases/decide";

export const decideRoutes = (d: Deps) =>
  new Hono<Env>()
    .get("/inputs/latest", async (c) => c.json(await d.uow.run(uid(c), (tx) => decide.latestInputs(tx))))
    .post("/inputs/account-snapshots", body(AccountSnapshotReq), async (c) =>
      c.json(await d.uow.run(uid(c), (tx) => decide.captureAccount(tx, c.req.valid("json"))), 201))
    .post("/inputs/market-snapshots", body(MarketSnapshotReq), async (c) =>
      c.json(await d.uow.run(uid(c), (tx) => decide.captureMarket(tx, c.req.valid("json"))), 201))
    .post("/inputs/rates", body(RateReq), async (c) => c.json(await d.uow.run(uid(c), (tx) => decide.captureRate(tx, c.req.valid("json"))), 201))
    .get("/memos", query(z.object({ cursor: z.string().optional(), phase: z.enum(["cash-put", "shares-held"]).optional(),
      decision: z.enum(["sell", "skip", "wait", "cover_call"]).optional() })), async (c) =>
      c.json(await d.uow.run(uid(c), (tx) => decide.listMemos(tx, c.req.valid("query")))))
    .post("/memos", body(CreateMemoReq), async (c) => c.json(await d.uow.run(uid(c), (tx) => decide.createMemo(d, tx, c.req.valid("json").phase)), 201))
    .get("/memos/:id", async (c) => c.json(await d.uow.run(uid(c), (tx) => decide.getMemo(d, tx, c.req.param("id")))))
    .post("/memos/:id/candidates:score", async (c) => c.json(await d.uow.run(uid(c), async (tx) => {
      await decide.scoreMemo(d, tx, c.req.param("id"));
      return decide.getMemo(d, tx, c.req.param("id"));
    })))
    .put("/memos/:id/stress/:kind", body(AttachStressReq), async (c) => {
      const kind = z.enum(["crash", "mc"]).parse(c.req.param("kind"));
      return c.json(await d.uow.run(uid(c), (tx) => decide.attachStress(tx, c.req.param("id"), kind, c.req.valid("json").result_id)));
    })
    .delete("/memos/:id/stress/:kind", async (c) => c.json(await d.uow.run(uid(c), (tx) => decide.detachStress(tx, c.req.param("id"), c.req.param("kind")))))
    .post("/memos/:id/skip", body(SkipReq), async (c) => {
      const b = c.req.valid("json");
      return c.json(await d.uow.run(uid(c), (tx) => decide.skipMemo(tx, c.req.param("id"), b.code, b.note)));
    })
    .post("/memos/:id/decide", body(DecideReq), async (c) => {
      const b = c.req.valid("json");
      return c.json(await d.uow.run(uid(c), (tx) => decide.decideMemo(tx, c.req.param("id"), b.decision, b.precommit_plan, b.rationale)));
    });
