import { AnnotationReq } from "@edge/contracts";
import { Hono } from "hono";
import * as z from "zod";
import { type Env, body, query, uid } from "../http";
import type { Deps } from "../ports";
import * as j from "../usecases/journal";

export const journalRoutes = (d: Deps) =>
  new Hono<Env>()
    .get("/ledger", query(z.object({ group: z.enum(["quarter", "hk_yoa"]).default("quarter"), mode: z.enum(["paper", "live"]).optional() })), async (c) => {
      const q = c.req.valid("query");
      return c.json(await d.uow.run(uid(c), (tx) => j.getLedger(tx, q.group, q.mode)));
    })
    .put("/ledger/:entryId/annotation", body(AnnotationReq), async (c) => {
      const b = c.req.valid("json");
      return c.json(await d.uow.run(uid(c), (tx) => j.annotate(tx, c.req.param("entryId"), b.hk_note, b.badges_of_trade_flag)));
    })
    .get("/journal/tax/hk.csv", query(z.object({ yoa: z.string().regex(/^\d{4}\/\d{2}$/).optional() })), async (c) => {
      const csv = await d.uow.run(uid(c), (tx) => j.hkCsv(tx, c.req.valid("query").yoa));
      return c.body(csv, 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="edgeinvest-hk-journal.csv"` });
    })
    .get("/audit", query(z.object({ before: z.coerce.number().int().optional(), action: z.string().max(60).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50) })), async (c) =>
      c.json(await d.uow.run(uid(c), (tx) => j.listAudit(tx, c.req.valid("query")))))
    .get("/audit/verify", async (c) => c.json(await d.uow.run(uid(c), (tx) => j.verifyAudit(tx))));
