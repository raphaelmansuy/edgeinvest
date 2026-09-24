#!/usr/bin/env bun
// Recreates the isolated e2e database (edgeinvest_e2e) and seeds every persona through the real use cases (docs/14 §3).
import { SQL } from "bun";
import { ownerUrl } from "./db-url";

const name = process.env.E2E_DB_NAME ?? "edgeinvest_e2e";
if (!/^[a-z_][a-z0-9_]*$/.test(name) || name === "edgeinvest") throw new Error(`refusing to recreate database ${name}`);

process.env.DB_NAME = "postgres";
const admin = new SQL(ownerUrl());
await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
await admin.unsafe(`CREATE DATABASE ${name}`);
await admin.close();

process.env.DB_NAME = name;
const proc = Bun.spawnSync(["bun", "run", "tools/migrate.ts"], { env: { ...process.env, DB_NAME: name, SEED_FIXTURES: "1", SEED_USER_EMAIL: "you@example.com" }, stdout: "inherit", stderr: "inherit" });
if (proc.exitCode !== 0) process.exit(proc.exitCode ?? 1);
console.log(`e2e database ${name} ready`);
