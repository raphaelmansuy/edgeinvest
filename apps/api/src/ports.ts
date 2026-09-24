// Ports (docs/07 §7.2). Use cases depend on these; adapters are wired only in compose.ts (DIP).
import type { ScrId } from "@edge/contracts";
import type { SQL } from "bun";

export interface Clock { now(): Date }

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json | undefined };
export type ActorKind = "user" | "agent" | "system";
export interface AuditEntry { action: string; scr?: ScrId; actor?: ActorKind; payload: { [k: string]: Json | undefined } }

/** A transaction with the RLS user context already set. SQL runs through `sql`; audit shares the same tx. */
export interface Tx {
  sql: SQL;
  userId: string;
  audit(e: AuditEntry): Promise<void>;
}
export interface UnitOfWork { run<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> }

export interface ChatMessage { role: "system" | "user" | "assistant" | "tool"; content: string; tool_calls?: ToolCall[]; tool_name?: string }
export interface ToolCall { function: { name: string; arguments: Record<string, unknown> } }
export interface ToolSpec { type: "function"; function: { name: string; description: string; parameters: unknown } }
export type ChatChunk = { type: "token"; text: string } | { type: "tool_calls"; calls: ToolCall[] } | { type: "done" };
export interface Llm {
  chat(req: { messages: ChatMessage[]; tools?: ToolSpec[]; temperature?: number }, signal: AbortSignal): AsyncIterable<ChatChunk>;
  embed(texts: string[]): Promise<number[][]>;
  status(): Promise<{ available: boolean; model: string; embedModel: string }>;
}

/** Read-only market data (no order methods, ever: docs/07 §9). */
export interface MarketDataPort {
  latestSpot(tx: Tx, underlying: "QQQ"): Promise<{ spot: string; asOf: Date; snapshotId: string } | null>;
}

export interface SimRunner {
  run<T>(kind: "mc" | "crash", params: unknown, timeoutMs: number): Promise<T>;
}

export interface Deps {
  sql: SQL;
  uow: UnitOfWork;
  clock: Clock;
  llm: Llm;
  sim: SimRunner;
  config: { allowedOrigins: string[]; secureCookies: boolean; agentModel: string; promptVersion: string };
}
