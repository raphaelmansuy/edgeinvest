import { Hono } from "hono";
import type { Env } from "../http";
import type { Deps } from "../ports";

export const agentRoutes = (d: Deps) =>
  new Hono<Env>()
    .get("/status", async (c) => {
      const s = await d.llm.status().catch(() => ({ available: false, model: d.config.agentModel, embedModel: "" }));
      return c.json({ ...s, prompt_version: d.config.promptVersion });
    });
