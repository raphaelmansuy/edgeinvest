import { createHash } from "node:crypto";
import { ENVELOPES, envelopeParamsCanonical } from "@edge/domain";
import { createApp } from "./app";
import { composeDeps } from "./compose";

const deps = composeDeps();

// Boot assertion (EC-EN-004): envelope config-as-code must match the DB mirror.
const rows = await deps.sql`select envelope_id, params_sha256 from app.envelope`;
for (const r of rows as { envelope_id: keyof typeof ENVELOPES; params_sha256: string }[]) {
  const e = ENVELOPES[r.envelope_id];
  const h = e && createHash("sha256").update(envelopeParamsCanonical(e)).digest("hex");
  if (h !== r.params_sha256) throw new Error(`ENVELOPE_DRIFT: ${r.envelope_id} code hash ${h} != db ${r.params_sha256}`);
}

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 8787);
const server = Bun.serve({ port, hostname: "0.0.0.0", fetch: createApp(deps).fetch, idleTimeout: 120 });
console.log(JSON.stringify({ msg: "api listening", port: server.port, agent: process.env.AGENT_PROVIDER ?? "ollama" }));
