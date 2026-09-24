// Composition root (docs/07 §7.1): the ONLY module that knows concrete adapters.
import { SQL } from "bun";
import { fixedClock, systemClock } from "./adapters/clock";
import { makeLlm } from "./adapters/llm";
import { pgUnitOfWork } from "./adapters/pg";
import { workerSimRunner } from "./adapters/sim";
import type { Deps } from "./ports";

export function composeDeps(env = process.env): Deps {
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const sql = new SQL({ url, max: 10, idleTimeout: 30 });
  const origins = (env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5183,http://127.0.0.1:5183")
    .split(",").map((s) => s.trim()).filter(Boolean);
  return {
    sql,
    uow: pgUnitOfWork(sql),
    clock: env.CLOCK_FIXED ? fixedClock(env.CLOCK_FIXED) : systemClock,
    llm: makeLlm(env),
    sim: workerSimRunner(),
    config: {
      allowedOrigins: origins,
      secureCookies: env.INSECURE_COOKIES !== "1",
      agentModel: env.AGENT_MODEL ?? "qwen3.5:9b-mlx",
      promptVersion: "agent-v1",
    },
  };
}
