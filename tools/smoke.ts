#!/usr/bin/env bun
// API smoke: every persona signs in and GETs every read endpoint; any 5xx (or unexpected 4xx) fails (docs/14 §2).
import { PASSWORD, PERSONAS } from "../e2e/fixtures/personas";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:8798";
const H = { Origin: BASE, "X-CSRF": "1", "Content-Type": "application/json" };

async function session(email: string) {
  const r = await fetch(`${BASE}/api/v1/auth/sign-in`, { method: "POST", headers: H, body: JSON.stringify({ email, password: PASSWORD }) });
  if (!r.ok) throw new Error(`sign-in ${email}: ${r.status}`);
  const cookie = r.headers.get("set-cookie")!.split(";")[0]!;
  return (path: string, init: RequestInit = {}) => fetch(`${BASE}/api/v1${path}`, { ...init, headers: { ...H, Cookie: cookie, ...(init.headers ?? {}) } });
}

const READS = ["/me", "/me/capabilities", "/me/disclosures", "/me/envelope", "/curriculum", "/curriculum/why", "/quiz/M1", "/learn/vocab", "/learn/tickets",
  "/mastery", "/game/catalog", "/game/attempts", "/lessons", "/sim/scenarios", "/sim/results", "/inputs/latest", "/memos", "/wheel/state",
  "/ledger?group=quarter", "/ledger?group=hk_yoa", "/audit", "/audit/verify", "/agent/status"];

let failures = 0;
for (const [p, email] of Object.entries(PERSONAS)) {
  const get = await session(email);
  const bad: string[] = [];
  for (const path of READS) {
    const r = await get(path);
    if (r.status >= 400) bad.push(`${path} ${r.status} ${(await r.text()).slice(0, 160)}`);
  }
  const memos = (await (await get("/memos")).json()) as { items: { memo_id: string; draft: { draft_id: string } | null }[] };
  for (const m of memos.items) {
    for (const path of [`/memos/${m.memo_id}`, ...(m.draft ? [`/drafts/${m.draft.draft_id}`] : [])]) {
      const r = await get(path);
      if (r.status >= 400) bad.push(`${path} ${r.status} ${(await r.text()).slice(0, 160)}`);
    }
  }
  const ws = (await (await get("/wheel/state")).json()) as { cycles: { cycle_id: string }[] };
  for (const c of ws.cycles ?? []) {
    const r = await get(`/cycles/${c.cycle_id}`);
    if (r.status >= 400) bad.push(`/cycles ${r.status} ${(await r.text()).slice(0, 160)}`);
  }
  const csv = await get("/journal/tax/hk.csv");
  if (!csv.ok) bad.push(`/journal/tax/hk.csv ${csv.status}`);
  const verify = (await (await get("/audit/verify")).json()) as { ok: boolean; count: number };
  if (!verify.ok) bad.push(`audit chain broken`);
  failures += bad.length;
  console.log(`${bad.length ? "FAIL" : "ok  "} ${p.padEnd(9)} audit=${verify.count}${bad.length ? `\n   ${bad.join("\n   ")}` : ""}`);
}
process.exit(failures ? 1 : 0);
