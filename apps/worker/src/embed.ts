// Embedding job: (re)indexes the content corpus into rag_chunk for the agent (docs/08 §6).
import type { Tx } from "@edge/api/ports";

export async function handleEmbed(_tx: Tx, _payload: Record<string, unknown>): Promise<string | null> {
  return null;
}
