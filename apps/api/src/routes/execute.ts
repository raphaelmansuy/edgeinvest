import { DraftReq, FillReq, HumanGateReq, LifecycleReq, LockedLossReq, StepReq, WillingnessReq } from "@edge/contracts";
import { Hono } from "hono";
import { type Env, body, uid } from "../http";
import type { Deps } from "../ports";
import * as ex from "../usecases/execute";

export const executeRoutes = (d: Deps) =>
  new Hono<Env>()
    .post("/drafts", body(DraftReq), async (c) => c.json(await d.uow.run(uid(c), (tx) => ex.prepareDraft(d, tx, c.req.valid("json"))), 201))
    .get("/drafts/:id", async (c) => c.json(await d.uow.run(uid(c), (tx) => ex.getDraft(d, tx, c.req.param("id")))))
    .post("/drafts/:id/review", async (c) => c.json(await d.uow.run(uid(c), (tx) => ex.reviewDraft(d, tx, c.req.param("id")))))
    .post("/drafts/:id/steps", body(StepReq), async (c) => {
      const b = c.req.valid("json");
      return c.json(await d.uow.run(uid(c), (tx) => ex.markStep(d, tx, c.req.param("id"), b.step, b.done)));
    })
    .post("/drafts/:id/human-gate", body(HumanGateReq), async (c) =>
      c.json(await d.uow.run(uid(c), (tx) => ex.humanGate(d, tx, c.req.param("id"), c.req.valid("json").live_phrase))))
    .delete("/drafts/:id", async (c) => c.json(await d.uow.run(uid(c), (tx) => ex.discardDraft(tx, c.req.param("id")))))
    .post("/drafts/:id/fill", body(FillReq), async (c) => {
      const b = c.req.valid("json");
      return c.json(await d.uow.run(uid(c), (tx) => ex.recordFill(d, tx, c.req.param("id"), b.price, b.filled_at)), 201);
    })
    .get("/cycles/:id", async (c) => c.json(await d.uow.run(uid(c), (tx) => ex.getCycle(d, tx, c.req.param("id")))))
    .post("/cycles/:id/events", body(LifecycleReq), async (c) =>
      c.json(await d.uow.run(uid(c), (tx) => ex.recordEvent(d, tx, c.req.param("id"), c.req.valid("json")))))
    .get("/wheel/state", async (c) => c.json(await d.uow.run(uid(c), (tx) => ex.wheelState(tx))))
    .post("/wheel/willingness", body(WillingnessReq), async (c) => {
      const b = c.req.valid("json");
      return c.json(await d.uow.run(uid(c), (tx) => ex.recordWillingness(tx, b.willing, b.statement)));
    })
    .delete("/wheel/halt", async (c) => c.json(await d.uow.run(uid(c), (tx) => ex.clearHalt(tx))))
    .post("/wheel/locked-loss-accept", body(LockedLossReq), async (c) =>
      c.json(await d.uow.run(uid(c), (tx) => ex.acceptLockedLoss(tx, c.req.valid("json").cycle_id))));
