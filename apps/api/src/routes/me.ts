import { AckReq, EnvelopeReq, ModeReq, PatchMeReq, SignInReq } from "@edge/contracts";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import * as z from "zod";
import { body, clientIp, type Env, query, rateLimit, SESSION_COOKIE, uid } from "../http";
import type { Deps } from "../ports";
import { problem } from "../problem";
import * as me from "../usecases/me";

export const authRoutes = (d: Deps) =>
  new Hono<Env>()
    .get("/dev-accounts", async (c) => {
      if (process.env.DEV_SIGNIN !== "1") throw problem("NOT_FOUND");
      const { DEV_PASSWORD, DEV_PERSONAS } = await import("../../../../e2e/fixtures/dev-accounts");
      const accounts: { email: string; name: string; blurb: string; password: string; recommended: boolean }[] = DEV_PERSONAS.map((p) => ({
        email: p.email,
        name: p.name,
        blurb: p.blurb,
        password: DEV_PASSWORD,
        recommended: "recommended" in p && p.recommended === true,
      }));
      const seedEmail = process.env.SEED_USER_EMAIL?.trim();
      const seedPassword = process.env.SEED_USER_PASSWORD;
      if (seedEmail && seedPassword && !accounts.some((a) => a.email === seedEmail)) {
        accounts.push({ email: seedEmail, name: "You", blurb: "Empty personal book", password: seedPassword, recommended: false });
      }
      return c.json({ accounts });
    })
    .post(
      "/sign-in",
      rateLimit("sign-in", 5, 15 * 60_000, (c) => `${clientIp(c)}`),
      body(SignInReq),
      async (c) => {
        const { email, password } = c.req.valid("json");
        const { token } = await me.signIn(d, email, password);
        setCookie(c, SESSION_COOKIE, token, {
          httpOnly: true,
          secure: d.config.secureCookies,
          sameSite: "Strict",
          path: "/",
          maxAge: 30 * 86_400,
        });
        return c.json({ ok: true });
      },
    )
    .post("/sign-out", query(z.object({ all: z.enum(["0", "1"]).optional() })), async (c) => {
      const userId = uid(c);
      await me.signOut(d, userId, c.get("sessionHash")!, c.req.valid("query").all === "1");
      deleteCookie(c, SESSION_COOKIE, { path: "/", secure: d.config.secureCookies });
      return c.json({ ok: true });
    });

export const meRoutes = (d: Deps) =>
  new Hono<Env>()
    .get("/capabilities", async (c) => {
      const userId = c.get("userId");
      if (!userId) {
        const { ANONYMOUS } = await import("@edge/contracts");
        return c.json(ANONYMOUS);
      }
      return c.json(await d.uow.run(userId, (tx) => me.computeCapabilities(d, tx)));
    })
    .get("/", async (c) => c.json(await d.uow.run(uid(c), (tx) => me.getMe(tx))))
    .patch("/", body(PatchMeReq), async (c) => c.json(await d.uow.run(uid(c), (tx) => me.patchMe(tx, c.req.valid("json")))))
    .get("/disclosures", async (c) => c.json(await d.uow.run(uid(c), (tx) => me.listDisclosures(tx))))
    .post("/disclosures/:key/ack", body(AckReq), async (c) => {
      const b = c.req.valid("json");
      return c.json(await d.uow.run(uid(c), (tx) => me.ackDisclosure(tx, c.req.param("key"), b.copy_version, b.scr)));
    })
    .post(
      "/disclosures/:key/view",
      query(
        z.object({
          scr: z
            .string()
            .regex(/^SCR-\d{3}$/)
            .default("SCR-073"),
        }),
      ),
      async (c) => {
        const { scr } = c.req.valid("query");
        await d.uow.run(uid(c), (tx) => me.viewDisclosure(tx, c.req.param("key"), scr));
        return c.json({ ok: true });
      },
    )
    .get("/envelope", async (c) => c.json(await d.uow.run(uid(c), (tx) => me.envelopeHistory(tx))))
    .patch("/envelope", body(EnvelopeReq), async (c) => {
      const b = c.req.valid("json");
      return c.json(await d.uow.run(uid(c), (tx) => me.selectEnvelope(tx, b.envelope_id, b.override, b.confirm_phrase)));
    })
    .patch("/mode", body(ModeReq), async (c) => {
      const b = c.req.valid("json");
      return c.json(await d.uow.run(uid(c), (tx) => me.setMode(d, tx, b.mode, b.confirm_phrase)));
    });
