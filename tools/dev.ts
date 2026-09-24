#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SQL } from "bun";
import { DEV_PASSWORD, DEV_PERSONAS } from "../e2e/fixtures/dev-accounts";
import { ownerUrl } from "./db-url";

const root = join(import.meta.dir, "..");
const devDir = join(root, ".dev");
const logDir = join(devDir, "logs");
const pidFile = join(devDir, "supervisor.pid");
const readyFile = join(devDir, "ready");

const webPort = Number(process.env.WEB_PORT ?? process.env.EDGE_WEB_PORT ?? 5183);
const apiPort = Number(process.env.API_PORT ?? process.env.EDGE_API_PORT ?? 8797);
const appUrl = `http://127.0.0.1:${webPort}`;
const apiUrl = `http://127.0.0.1:${apiPort}`;

const mode = process.argv[2];
mkdirSync(logDir, { recursive: true });

function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPid(): number | null {
  try {
    const n = Number(readFileSync(pidFile, "utf8").trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function listener(port: number): number | null {
  const r = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" });
  const line = r.stdout.trim().split("\n").find(Boolean);
  const n = line ? Number(line) : NaN;
  return Number.isInteger(n) ? n : null;
}

function run(cmd: string[], env?: Record<string, string>) {
  const r = spawnSync(cmd[0]!, cmd.slice(1), {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const recommended = DEV_PERSONAS.find((p) => "recommended" in p && p.recommended);
const seedEmail = process.env.SEED_USER_EMAIL?.trim();
const seedPassword = process.env.SEED_USER_PASSWORD;

function banner(): string {
  const lines = [
    "",
    "EdgeInvest is ready",
    "",
    `  Open      ${appUrl}/sign-in`,
    `  API       ${apiUrl}`,
    "",
    `  Password  ${DEV_PASSWORD}`,
    `  Try       ${recommended?.email ?? "putter@edge.test"}  (${recommended?.name ?? "Pat"}, ${recommended?.blurb ?? "a complete put packet"})`,
    "",
  ];
  if (seedEmail && seedPassword && seedPassword !== DEV_PASSWORD) {
    lines.push(`  Also      ${seedEmail}`, `            password ${seedPassword}`, "");
  } else if (seedEmail) {
    lines.push(`  Also      ${seedEmail}  (empty personal book, same password)`, "");
  }
  lines.push(
    "  The sign-in screen lists every practice account.",
    "  Ctrl-C stops the app. The database stays up.",
    "  make stop also stops this project's database container.",
    "",
  );
  return lines.join("\n");
}

async function userExists(email: string): Promise<boolean> {
  const sql = new SQL(ownerUrl());
  try {
    const [row] = await sql`select 1 as ok from app.app_user where lower(email) = ${email.toLowerCase()} and deleted_at is null`;
    return Boolean(row);
  } catch {
    return false;
  } finally {
    await sql.close();
  }
}

function assertPortFree(port: number, label: string) {
  const pid = listener(port);
  if (!pid) return;
  console.error(`${label} port ${port} is already in use (pid ${pid}).`);
  console.error("Stop that process, or run `make stop` if it is a previous EdgeInvest dev server.");
  process.exit(1);
}

const children: ReturnType<typeof Bun.spawn>[] = [];
let stopping = false;

function killTree(pid: number) {
  spawnSync("pkill", ["-TERM", "-P", String(pid)]);
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* already gone */
  }
}

async function shutdown(code: number) {
  if (stopping) return;
  stopping = true;
  for (const child of children) killTree(child.pid);
  const deadline = Date.now() + 4000;
  while (children.some((c) => c.exitCode === null) && Date.now() < deadline) await Bun.sleep(50);
  for (const child of children) if (child.exitCode === null) child.kill("SIGKILL");
  rmSync(readyFile, { force: true });
  const recorded = readPid();
  if (recorded === process.pid) rmSync(pidFile, { force: true });
  if (code !== 0) console.error("\nEdgeInvest stopped because a process exited. See .dev/logs/.");
  process.exit(code);
}

async function pipe(stream: ReadableStream<Uint8Array> | null, name: string, writer: ReturnType<ReturnType<typeof Bun.file>["writer"]>) {
  if (!stream) return;
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const label = name.padEnd(7);
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    writer.write(value);
    buf += dec.decode(value, { stream: true });
    let nl = buf.indexOf("\n");
    while (nl >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.trim()) console.log(`${label} ${line}`);
      nl = buf.indexOf("\n");
    }
  }
  writer.flush();
}

function spawnLogged(name: string, cmd: string[], extra: Record<string, string>, cwd = root) {
  const writer = Bun.file(join(logDir, `${name}.log`)).writer();
  const proc = Bun.spawn(cmd, {
    cwd,
    env: { ...process.env, ...extra },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    onExit: (_proc, exitCode, signal) => {
      if (stopping || exitCode === 0) return;
      console.error(`${name} exited (${signal ?? exitCode}). See .dev/logs/${name}.log`);
      void shutdown(1);
    },
  });
  void pipe(proc.stdout, name, writer);
  void pipe(proc.stderr, name, writer);
  children.push(proc);
  return proc;
}

async function waitOk(url: string, seconds: number) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* still booting */
    }
    await Bun.sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function serve() {
  const existing = readPid();
  if (existing && existing !== process.pid && alive(existing)) {
    console.log(banner());
    console.log("Already running. `make logs` follows output, `make stop` shuts it down.\n");
    return;
  }
  writeFileSync(pidFile, `${process.pid}\n`);
  rmSync(readyFile, { force: true });

  console.log("Starting this project's database…");
  run(["docker", "compose", "up", "-d", "--wait", "db"]);
  console.log("Applying migrations…");
  run(["bun", "run", "tools/migrate.ts"]);

  const persona = recommended?.email ?? "putter@edge.test";
  if (!(await userExists(persona))) {
    console.log("Seeding practice accounts (the first time takes a minute)…");
    run(["bun", "run", "tools/seed.ts"], { SEED_FIXTURES: "1" });
  } else if (seedEmail && !(await userExists(seedEmail))) {
    run(["bun", "run", "tools/seed.ts"]);
  }

  assertPortFree(apiPort, "API");
  assertPortFree(webPort, "Web");

  const origins = [`http://127.0.0.1:${webPort}`, `http://localhost:${webPort}`].join(",");
  spawnLogged("api", ["bun", "--watch", "apps/api/src/main.ts"], {
    DEV_SIGNIN: "1",
    INSECURE_COOKIES: "1",
    RATE_LIMITS: "off",
    API_PORT: String(apiPort),
    ALLOWED_ORIGINS: origins,
  });
  spawnLogged("worker", ["bun", "--watch", "apps/worker/src/main.ts"], {});
  spawnLogged(
    "web",
    ["bun", "x", "vite", "--host", "127.0.0.1"],
    {
      WEB_PORT: String(webPort),
      API_PROXY_TARGET: apiUrl,
    },
    join(root, "apps/web"),
  );

  try {
    await waitOk(`${apiUrl}/healthz`, 45);
    await waitOk(appUrl, 60);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    await shutdown(1);
  }

  const text = banner();
  writeFileSync(readyFile, text);
  console.log(text);

  process.on("SIGINT", () => void shutdown(0));
  process.on("SIGTERM", () => void shutdown(0));
  await new Promise(() => undefined);
}

async function background() {
  const existing = readPid();
  if (existing && alive(existing)) {
    console.log(readReady());
    console.log("Already running. `make logs` follows output, `make stop` shuts it down.\n");
    return;
  }
  rmSync(readyFile, { force: true });
  const proc = Bun.spawn(["nohup", "bun", "run", "tools/dev.ts"], {
    cwd: root,
    stdin: "ignore",
    stdout: Bun.file(join(logDir, "supervisor.log")),
    stderr: Bun.file(join(logDir, "supervisor.log")),
  });
  proc.unref();
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try {
      const text = readFileSync(readyFile, "utf8");
      if (text.includes("EdgeInvest is ready")) {
        console.log(text);
        return;
      }
    } catch {
      /* not ready yet */
    }
    if (proc.exitCode !== null) {
      console.error("The dev server exited before it was ready. See .dev/logs/supervisor.log");
      process.exit(proc.exitCode ?? 1);
    }
    await Bun.sleep(300);
  }
  console.error("Timed out waiting for EdgeInvest. See .dev/logs/supervisor.log");
  process.exit(1);
}

function readReady(): string {
  try {
    return readFileSync(readyFile, "utf8");
  } catch {
    return "";
  }
}

async function stop() {
  const pid = readPid();
  if (pid && alive(pid)) {
    console.log("Stopping the app…");
    process.kill(pid, "SIGTERM");
    const deadline = Date.now() + 8000;
    while (alive(pid) && Date.now() < deadline) await Bun.sleep(100);
    if (alive(pid)) process.kill(pid, "SIGKILL");
  }
  for (const port of [apiPort, webPort]) {
    const occupant = listener(port);
    if (!occupant) continue;
    const command = spawnSync("ps", ["-p", String(occupant), "-o", "command="], { encoding: "utf8" }).stdout;
    if (/apps\/api\/src\/main\.ts|apps\/worker\/src\/main\.ts|apps\/web/.test(command)) killTree(occupant);
  }
  console.log("Stopping this project's database container…");
  const stopped = spawnSync("docker", ["compose", "stop", "db"], { cwd: root, encoding: "utf8" });
  if (stopped.status !== 0) {
    console.error(stopped.stderr || stopped.stdout);
    process.exit(stopped.status ?? 1);
  }
  rmSync(readyFile, { force: true });
  rmSync(pidFile, { force: true });
  console.log("EdgeInvest is stopped. Other Docker containers were left alone.");
}

function status() {
  const pid = readPid();
  const running = pid !== null && alive(pid);
  console.log(running ? `App        running (pid ${pid})` : "App        stopped");
  console.log(`Web        ${listener(webPort) ? appUrl : "not listening"}`);
  console.log(`API        ${listener(apiPort) ? apiUrl : "not listening"}`);
  const ps = spawnSync("docker", ["compose", "ps", "db", "--format", "{{.Service}} {{.Status}}"], { cwd: root, encoding: "utf8" });
  const line = ps.stdout.trim().split("\n").find(Boolean);
  console.log(`Database   ${line || "not running"}  (this project only)`);
  if (running && readReady()) console.log(readReady());
}

if (mode === "--background") await background();
else if (mode === "--stop") await stop();
else if (mode === "--status") status();
else await serve();
