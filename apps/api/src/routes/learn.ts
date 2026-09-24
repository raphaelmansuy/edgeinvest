import { GameStartReq, GameStepReq, QuizAttemptReq } from "@edge/contracts";
import { Hono } from "hono";
import * as z from "zod";
import { type Env, body, uid } from "../http";
import type { Deps } from "../ports";
import * as learn from "../usecases/learn";
import { getMastery } from "../usecases/mastery";

const Answers = z.object({ seed: z.number().int().min(0), answers: z.record(z.string(), z.string().max(200)) });

export const learnRoutes = (d: Deps) =>
  new Hono<Env>()
    .get("/curriculum", (c) => c.json(learn.listModules()))
    .get("/curriculum/:slug", (c) => c.json(learn.getCurriculum(c.req.param("slug"))))
    .get("/quiz/:module", async (c) => c.json(await d.uow.run(uid(c), (tx) => learn.getQuiz(tx, c.req.param("module")))))
    .post("/quiz/:module/attempts", body(QuizAttemptReq), async (c) => {
      const b = c.req.valid("json");
      return c.json(await d.uow.run(uid(c), (tx) => learn.submitQuiz(tx, c.req.param("module"), b.seed, b.answers)), 201);
    })
    .post("/quiz/attempts/:id/remediation/:tag", async (c) =>
      c.json(await d.uow.run(uid(c), (tx) => learn.openRemediation(tx, c.req.param("id"), c.req.param("tag")))))
    .get("/learn/vocab", (c) => c.json(learn.getVocabRun()))
    .post("/learn/vocab", body(Answers), async (c) => {
      const b = c.req.valid("json");
      return c.json(await d.uow.run(uid(c), (tx) => learn.submitVocab(tx, b.seed, b.answers)));
    })
    .get("/learn/tickets", (c) => c.json(learn.getTicket()))
    .post("/learn/tickets", body(Answers), async (c) => {
      const b = c.req.valid("json");
      return c.json(await d.uow.run(uid(c), (tx) => learn.submitTicket(tx, b.seed, b.answers)));
    })
    .get("/mastery", async (c) => c.json(await d.uow.run(uid(c), (tx) => getMastery(tx))))
    .get("/game/catalog", (c) => c.json(learn.gameCatalog()))
    .get("/game/attempts", async (c) => c.json(await d.uow.run(uid(c), (tx) => learn.listGames(tx))))
    .post("/game/attempts", body(GameStartReq), async (c) => {
      const b = c.req.valid("json");
      return c.json(await d.uow.run(uid(c), (tx) => learn.startGame(tx, b.mode, b.scenario_id)), 201);
    })
    .get("/game/attempts/:id", async (c) => c.json(await d.uow.run(uid(c), (tx) => learn.getGame(tx, c.req.param("id")))))
    .patch("/game/attempts/:id", body(GameStepReq), async (c) => {
      const b = c.req.valid("json");
      return c.json(await d.uow.run(uid(c), (tx) => learn.stepGame(tx, c.req.param("id"), b.decision)));
    })
    .get("/lessons", async (c) => c.json(await d.uow.run(uid(c), (tx) => learn.listLessons(tx))));
