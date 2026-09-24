import { CRASH_SCENARIOS, type CrashParams, type McParams, replayCrash, runPutsOnlyMc } from "@edge/sim";

export function runSim(kind: "mc" | "crash", params: unknown) {
  if (kind === "mc") return runPutsOnlyMc(params as McParams);
  const p = params as CrashParams & { scenarioId: string };
  return replayCrash(CRASH_SCENARIOS[p.scenarioId]!, p);
}
