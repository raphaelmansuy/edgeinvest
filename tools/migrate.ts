#!/usr/bin/env bun
// Forward-only migrator with checksums (docs/09 §12). Runs as the DB owner; rotates the edge_app password
// from EDGE_APP_PASSWORD (docs/07 §10) and optionally seeds fixtures (SEED_FIXTURES=1, e2e only).
import { SQL } from "bun";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ownerUrl } from "./db-url";

const dir = join(import.meta.dir, "../db/migrations");
const sql = new SQL(ownerUrl());

async function main() {
  for (let i = 0; ; i++) {
    try {
      await sql`select 1`;
      break;
    } catch (e) {
      if (i > 30) throw e;
      await Bun.sleep(1000);
    }
  }
  await sql`create table if not exists public.schema_migrations (
    name text primary key, sha256 text not null, applied_at timestamptz not null default now())`;
  const applied = new Map((await sql`select name, sha256 from public.schema_migrations`).map((r: { name: string; sha256: string }) => [r.name, r.sha256]));
  const files = readdirSync(dir).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
  for (const f of files) {
    const body = readFileSync(join(dir, f), "utf8");
    const sum = createHash("sha256").update(body).digest("hex");
    const prior = applied.get(f);
    if (prior && prior !== sum) throw new Error(`MIGRATION_CHECKSUM_MISMATCH: ${f} was edited after being applied`);
    if (prior) continue;
    await sql.unsafe(body);
    await sql`insert into public.schema_migrations (name, sha256) values (${f}, ${sum})`;
    console.log(`applied ${f}`);
  }
  const appPassword = process.env.EDGE_APP_PASSWORD;
  if (!appPassword) throw new Error("EDGE_APP_PASSWORD is required");
  await sql.unsafe(`ALTER ROLE edge_app PASSWORD '${appPassword.replaceAll("'", "''")}'`);
  if (process.env.SEED_FIXTURES === "1" || process.argv.includes("--seed")) {
    const { seed } = await import("./seed");
    await seed(sql);
  }
  console.log("migrations up to date");
}

await main().finally(() => sql.close());
