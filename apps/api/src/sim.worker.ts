// Worker thread for inline simulations (docs/10 §8). Receives params, posts a summary only (never 10k paths).
import { runSim } from "./adapters/sim-dispatch";

declare const self: Worker;

self.onmessage = (ev: MessageEvent<{ kind: "mc" | "crash"; params: unknown }>) => {
  try {
    postMessage({ ok: true, result: runSim(ev.data.kind, ev.data.params) });
  } catch (e) {
    postMessage({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
};
