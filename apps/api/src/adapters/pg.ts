// Postgres adapters: unit of work (RLS context + audit in one transaction, docs/07 §7.3) and audit hashing.
import type { SQL } from "bun";
import { createHash } from "node:crypto";
import canonicalize from "canonicalize";
import type { AuditEntry, Tx, UnitOfWork } from "../ports";

export const jcs = (v: unknown) => canonicalize(v) ?? "null";
export const sha256 = (s: string | Uint8Array) => createHash("sha256").update(s).digest();
export const sha256hex = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");

/** Postgres array literal for TEXT[] params (the driver serialises an empty JS array as ''). Cast with ::text[]. */
export const textArray = (xs: readonly string[]) => `{${xs.map((x) => `"${x.replace(/["\\]/g, "\\$&")}"`).join(",")}}`;

function stripUndefined<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function makeTx(sql: SQL, userId: string): Tx {
  return {
    sql,
    userId,
    async audit(e: AuditEntry) {
      const payload = stripUndefined(e.payload);
      const hash = sha256(jcs(payload));
      await sql`insert into app.audit_event (user_id, actor, action, scr_id, payload, payload_hash, chain_hash, seq)
                values (${userId}, ${e.actor ?? "user"}, ${e.action}, ${e.scr ?? null}, ${payload}, ${hash}, ${Buffer.alloc(0)}, 0)`;
    },
  };
}

export const pgUnitOfWork = (sql: SQL): UnitOfWork => ({
  run: (userId, fn) =>
    sql.begin(async (tx) => {
      await tx`select set_config('app.user_id', ${userId}, true)`;
      return fn(makeTx(tx as unknown as SQL, userId));
    }) as never,
});

/** Recomputes payload hashes and the chain (docs/09 §7). Returns the first broken seq, if any. */
export async function verifyAuditChain(tx: Tx) {
  const rows = await tx.sql`select seq, action, payload, payload_hash, prev_hash, chain_hash from app.audit_event order by seq`;
  let prev: Buffer | null = null;
  for (const r of rows as { seq: string; action: string; payload: unknown; payload_hash: Buffer; prev_hash: Buffer | null; chain_hash: Buffer }[]) {
    const ph = sha256(jcs(r.payload));
    const expected = sha256(Buffer.concat([prev ?? Buffer.alloc(0), r.payload_hash, Buffer.from(`${r.action}|${r.seq}`, "utf8")]));
    const prevOk = (prev === null && r.prev_hash === null) || (prev !== null && r.prev_hash !== null && prev.equals(r.prev_hash));
    if (!ph.equals(r.payload_hash) || !expected.equals(r.chain_hash) || !prevOk) {
      return { ok: false as const, count: rows.length, broken_at: Number(r.seq), head: null };
    }
    prev = r.chain_hash;
  }
  return { ok: true as const, count: rows.length, broken_at: null, head: prev ? prev.toString("hex") : null };
}
