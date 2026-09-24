import type { SimRunner } from "../ports";
import { problem } from "../problem";
import { runSim } from "./sim-dispatch";

/** Same computation on the calling thread: tests and fixture seeding. */
export const inlineSimRunner = (): SimRunner => ({
  async run<T>(kind: "mc" | "crash", params: unknown) {
    try {
      return runSim(kind, params) as T;
    } catch (e) {
      throw problem("VALIDATION_FAILED", e instanceof Error ? e.message : String(e));
    }
  },
});

/** One Worker per run: a timeout terminates the thread, so no partial result is ever stored (EC-SM-003). */
export const workerSimRunner = (): SimRunner => ({
  run<T>(kind: "mc" | "crash", params: unknown, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const w = new Worker(new URL("../sim.worker.ts", import.meta.url).href);
      const timer = setTimeout(() => {
        w.terminate();
        reject(problem("SIM_TIMEOUT", `Simulation exceeded ${timeoutMs} ms. Try fewer paths.`));
      }, timeoutMs);
      w.onmessage = (ev: MessageEvent<{ ok: boolean; result?: T; error?: string }>) => {
        clearTimeout(timer);
        w.terminate();
        if (ev.data.ok) resolve(ev.data.result as T);
        else reject(problem("VALIDATION_FAILED", ev.data.error));
      };
      w.onerror = (e) => {
        clearTimeout(timer);
        w.terminate();
        reject(new Error(`SIM_WORKER_ERROR: ${e.message}`));
      };
      w.postMessage({ kind, params });
    });
  },
});
