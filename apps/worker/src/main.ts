// Job worker (docs/07 §11): LISTEN job_queued + 5 s poll; claim_job() hands out ids across users, each job then
// runs inside that user's RLS context. Handlers are a registry so new job kinds never touch the loop (OCP).
import { pgUnitOfWork } from "@edge/api/adapters/pg";
import type { Tx } from "@edge/api/ports";
import { storeResult } from "@edge/api/usecases/sim";
import { BACKTEST_MODEL_VERSION, MONTHLY, runBacktest } from "@edge/sim";
import { SQL } from "bun";
import { hostname } from "node:os";
import { handleEmbed } from "./embed";

type Handler = (tx: Tx, payload: Record<string, unknown>, progress: (f: number) => Promise<void>) => Promise<string | null>;

const HANDLERS: Record<string, Handler> = {
  async backtest(tx, p, progress) {
    const params = { otm: Number(p.otm), startCash: Number(p.startCash), maxContracts: Number(p.maxContracts ?? 1), start: String(p.start), end: String(p.end), wheel: Boolean(p.wheel) };
    const marks: number[] = [];
    const result = runBacktest(MONTHLY, params, (f) => marks.push(f));
    for (const f of marks) await progress(f * 0.95);
    const { result_id } = await storeResult(tx, "backtest", BACKTEST_MODEL_VERSION, null, p, result);
    return result_id;
  },
  embed: handleEmbed,
};

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = new SQL({ url, max: 4 });
const uow = pgUnitOfWork(sql);
const me = `${hostname()}:${process.pid}`;
const BACKOFF_S = [5, 30, 120];

async function processOne(): Promise<boolean> {
  const [claimed] = await sql`select * from app.claim_job(${me})`;
  if (!claimed) return false;
  const { job_id, user_id } = claimed as { job_id: string; user_id: string };
  try {
    await uow.run(user_id, async (tx) => {
      const [job] = await tx.sql`select kind, payload from app.job where job_id = ${job_id}`;
      const handler = HANDLERS[job.kind as string];
      if (!handler) throw new Error(`UNKNOWN_JOB_KIND ${job.kind}`);
      const progress = (f: number) => uow.run(user_id, async (p) => {
        await p.sql`update app.job set progress = ${Math.min(1, Math.max(0, f)).toFixed(3)}, updated_at = now() where job_id = ${job_id}`;
      });
      const resultId = await handler(tx, job.payload, progress);
      await tx.sql`update app.job set status = 'succeeded', result_id = ${resultId}, progress = 1, updated_at = now(), locked_by = null where job_id = ${job_id}`;
      await tx.audit({ action: "job_succeeded", actor: "system", payload: { job: job_id, kind: job.kind, result_id: resultId } });
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await uow.run(user_id, async (tx) => {
      const [j] = await tx.sql`select attempts, max_attempts from app.job where job_id = ${job_id}`;
      const final = j.attempts >= j.max_attempts || message.startsWith("BACKTEST_WINDOW_TOO_SHORT");
      const delay = BACKOFF_S[Math.min(j.attempts - 1, BACKOFF_S.length - 1)]!;
      await tx.sql`update app.job set status = ${final ? "failed" : "queued"}, error = ${{ message }}, locked_by = null, updated_at = now(),
                     run_after = now() + make_interval(secs => ${delay}) where job_id = ${job_id}`;
      await tx.audit({ action: final ? "job_failed" : "job_retry", actor: "system", payload: { job: job_id, message } });
    });
    console.error(JSON.stringify({ level: "error", job_id, message }));
  }
  return true;
}

let draining = false;
async function drain() {
  if (draining) return;
  draining = true;
  try { while (await processOne()); } finally { draining = false; }
}

await sql`select app.reap_jobs()`;
await drain();
const listener = new SQL({ url, max: 1 });
try {
  await (listener as unknown as { listen?: (ch: string, cb: () => void) => Promise<void> }).listen?.("job_queued", () => void drain());
} catch { /* LISTEN unsupported by the driver: polling below still drains */ }
setInterval(() => void drain(), 5000);
setInterval(() => void sql`select app.reap_jobs()`.catch(() => {}), 60_000);
setInterval(() => void sql`select app.purge_idempotency()`.catch(() => {}), 3_600_000);
console.log(JSON.stringify({ level: "info", msg: "worker ready", worker: me }));
