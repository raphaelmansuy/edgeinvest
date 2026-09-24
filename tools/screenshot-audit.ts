#!/usr/bin/env bun
/**
 * Capture desktop-light screenshots for every SCR and run axe-core.
 * Requires `make dev` (web 5183, API 8797). Writes docs/e2e/screenshots + specs audit.
 *
 *   bun run tools/screenshot-audit.ts
 */
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type BrowserContext } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCREEN_LIST, type ScrId } from "../packages/contracts/src/screens";
import { DEV_PASSWORD, DEV_PERSONAS } from "../e2e/fixtures/dev-accounts";

const WEB = process.env.WEB_ORIGIN ?? "http://127.0.0.1:5183";
const API = process.env.API_ORIGIN ?? "http://127.0.0.1:8797";
const OUT = join(import.meta.dir, "../docs/e2e/screenshots");
const REPORT = join(import.meta.dir, "../specs/01-ux-ui-improvement/05-screenshot-a11y-audit.md");

type Persona = (typeof DEV_PERSONAS)[number]["id"];
type Ids = { memoId?: string; callMemoId?: string; draftId?: string; callDraftId?: string; cycleId?: string; callCycleId?: string };

const PERSONA_FOR: Partial<Record<ScrId, Persona>> = {
  "SCR-100": "newbie",
  "SCR-101": "newbie",
  "SCR-000": "putter",
  "SCR-031": "putter",
  "SCR-032": "putter",
  "SCR-040": "drafter",
  "SCR-041": "drafter",
  "SCR-042": "drafter",
  "SCR-103": "shortput",
  "SCR-034": "shortput",
  "SCR-035": "holder",
  "SCR-036": "holder",
  "SCR-037": "holder",
  "SCR-038": "caller",
  "SCR-043": "caller",
  "SCR-044": "caller",
  "SCR-045": "halted",
  "SCR-046": "master",
  "SCR-050": "master",
  "SCR-051": "master",
};

async function apiSignIn(email: string, password: string) {
  const r = await fetch(`${API}/api/v1/auth/sign-in`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-CSRF": "1",
      Origin: WEB,
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`sign-in ${email} → ${r.status}`);
  const set = r.headers.getSetCookie?.() ?? [];
  // Bun may expose getSetCookie; fall back to set-cookie
  const raw = set.length ? set : [r.headers.get("set-cookie") ?? ""];
  const cookies = raw
    .flatMap((h) => h.split(/,(?=\s*[^;=]+=)/))
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const [nv] = c.split(";").map((s) => s.trim());
      const eq = nv!.indexOf("=");
      const name = nv!.slice(0, eq);
      const value = nv!.slice(eq + 1);
      return {
        name,
        value,
        url: WEB,
        httpOnly: true,
        sameSite: "Strict" as const,
        secure: false,
      };
    })
    .filter((c) => c.name && c.value);
  return cookies;
}

async function apiJson(path: string, cookieHeader: string) {
  const r = await fetch(`${API}${path}`, { headers: { cookie: cookieHeader, Origin: WEB } });
  if (!r.ok) return null;
  return r.json();
}

async function resolveIds(email: string, cookies: { name: string; value: string }[]): Promise<Ids> {
  const header = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const memos = (await apiJson("/api/v1/memos", header)) as { items?: { memo_id: string; phase: string; draft?: { draft_id: string; put_call: string } | null }[] } | null;
  const wheel = (await apiJson("/api/v1/wheel/state", header)) as { cycles?: { cycle_id: string; open_leg?: { put_call: string } | null }[] } | null;
  const ids: Ids = {};
  for (const m of memos?.items ?? []) {
    if (m.phase === "shares-held") {
      ids.callMemoId ??= m.memo_id;
      if (m.draft) ids.callDraftId ??= m.draft.draft_id;
    } else {
      ids.memoId ??= m.memo_id;
      if (m.draft) ids.draftId ??= m.draft.draft_id;
    }
  }
  for (const c of wheel?.cycles ?? []) {
    if (c.open_leg?.put_call === "C") ids.callCycleId ??= c.cycle_id;
    else if (c.open_leg?.put_call === "P") ids.cycleId ??= c.cycle_id;
    else ids.cycleId ??= c.cycle_id;
  }
  void email;
  return ids;
}

function resolveRoute(route: string, ids: Ids): string | null {
  let out = route;
  if (out.includes("$memoId")) {
    const id = out.includes("call-packet") ? ids.callMemoId ?? ids.memoId : ids.memoId ?? ids.callMemoId;
    if (!id) return null;
    out = out.replace("$memoId", id);
  }
  if (out.includes("$draftId")) {
    const id = out.includes("call-") ? ids.callDraftId ?? ids.draftId : ids.draftId ?? ids.callDraftId;
    if (!id) return null;
    out = out.replace("$draftId", id);
  }
  if (out.includes("$cycleId")) {
    const wantCall = out.includes("short-call");
    const id = wantCall ? ids.callCycleId ?? ids.cycleId : ids.cycleId ?? ids.callCycleId;
    if (!id) return null;
    out = out.replace("$cycleId", id);
  }
  if (out.includes("$module")) out = out.replace("$module", "M1");
  if (out.includes("$scenarioId")) {
    if (out.includes("/crash/")) out = out.replace("$scenarioId", "gfc_2008");
    else out = out.replace("$scenarioId", "steady-2024");
  }
  return out;
}

type Finding = { scr: ScrId; route: string; persona: string; violations: { id: string; impact: string | null; help: string; nodes: number }[]; note?: string };

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const findings: Finding[] = [];
  const cookieCache = new Map<Persona, { cookies: Awaited<ReturnType<typeof apiSignIn>>; ids: Ids }>();

  async function ensure(persona: Persona) {
    let hit = cookieCache.get(persona);
    if (!hit) {
      const email = DEV_PERSONAS.find((p) => p.id === persona)!.email;
      const cookies = await apiSignIn(email, DEV_PASSWORD);
      const ids = await resolveIds(email, cookies);
      hit = { cookies, ids };
      cookieCache.set(persona, hit);
    }
    return hit;
  }

  // Sign-in without session
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, colorScheme: "light", baseURL: WEB });
    const page = await ctx.newPage();
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, "SCR-100-desktop-light.png"), fullPage: true });
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    findings.push({
      scr: "SCR-100",
      route: "/sign-in",
      persona: "(anonymous)",
      violations: axe.violations.map((v) => ({ id: v.id, impact: v.impact ?? null, help: v.help, nodes: v.nodes.length })),
    });
    await ctx.close();
  }

  for (const scr of SCREEN_LIST) {
    if (scr.id === "SCR-100") continue;
    const persona = PERSONA_FOR[scr.id] ?? "putter";
    const { cookies, ids } = await ensure(persona);
    const path = resolveRoute(scr.route, ids);
    if (!path) {
      findings.push({ scr: scr.id, route: scr.route, persona, violations: [], note: "skipped — missing fixture ids for this persona" });
      continue;
    }
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, colorScheme: "light", baseURL: WEB });
    await ctx.addCookies(cookies);
    const page = await ctx.newPage();
    try {
      await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForSelector("[data-scr-current], [data-scr], h1", { timeout: 15_000 }).catch(() => null);
      await page.waitForTimeout(400);
      const file = join(OUT, `${scr.id}-desktop-light.png`);
      await page.screenshot({ path: file, fullPage: true });
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).disableRules(["color-contrast"]).analyze();
      // color-contrast is re-enabled selectively after token polish; still collect serious others
      const contrast = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
      const merged = [...axe.violations, ...contrast.violations.filter((v) => (v.impact === "serious" || v.impact === "critical"))];
      findings.push({
        scr: scr.id,
        route: path,
        persona,
        violations: merged.map((v) => ({ id: v.id, impact: v.impact ?? null, help: v.help, nodes: v.nodes.length })),
      });
      process.stdout.write(`${scr.id} ${path} ax=${merged.length}\n`);
    } catch (e) {
      findings.push({ scr: scr.id, route: path, persona, violations: [], note: `error: ${e instanceof Error ? e.message : String(e)}` });
      process.stdout.write(`${scr.id} FAIL ${e}\n`);
    } finally {
      await ctx.close();
    }
  }

  await browser.close();

  const serious = findings.flatMap((f) => f.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => ({ ...v, scr: f.scr, route: f.route })));
  const lines = [
    "# 05 · Screenshot & accessibility audit",
    "",
    `Generated by \`bun run tools/screenshot-audit.ts\` against ${WEB}.`,
    `Desktop light PNGs: \`docs/e2e/screenshots/SCR-*-desktop-light.png\` (${SCREEN_LIST.length} screens).`,
    "",
    "## Summary",
    "",
    `| Metric | Count |`,
    `|--------|------:|`,
    `| Screens visited | ${findings.filter((f) => !f.note?.startsWith("skipped") && !f.note?.startsWith("error")).length} |`,
    `| Skipped (no fixture ids) | ${findings.filter((f) => f.note?.startsWith("skipped")).length} |`,
    `| Errors | ${findings.filter((f) => f.note?.startsWith("error")).length} |`,
    `| Screens with axe findings | ${findings.filter((f) => f.violations.length).length} |`,
    `| Serious/critical nodes | ${serious.reduce((n, s) => n + s.nodes, 0)} |`,
    "",
    "## Serious / critical",
    "",
  ];
  if (!serious.length) lines.push("_None._", "");
  else {
    lines.push("| SCR | Rule | Impact | Help | Nodes |", "|-----|------|--------|------|------:|");
    for (const s of serious) lines.push(`| ${s.scr} | \`${s.id}\` | ${s.impact} | ${s.help} | ${s.nodes} |`);
    lines.push("");
  }
  lines.push("## Per screen", "");
  for (const f of findings) {
    lines.push(`### ${f.scr} · \`${f.route}\` (${f.persona})`);
    if (f.note) lines.push(`- ${f.note}`);
    if (!f.violations.length) lines.push("- axe: clean");
    else for (const v of f.violations) lines.push(`- **${v.impact ?? "?"}** \`${v.id}\` — ${v.help} (${v.nodes})`);
    lines.push("");
  }
  lines.push("## Follow-ups applied in kit", "");
  lines.push("- Button / nav / SubNav: visible `focus-visible` rings; SubNav Left/Right/Home/End");
  lines.push("- Field: `aria-describedby` + `aria-invalid` cloned onto controls");
  lines.push("- Tabs: arrow / Home / End; roving `tabIndex`");
  lines.push("- Dialog: focus first control on open; Escape/`cancel` closes; restore focus");
  lines.push("- Account menu: Escape restores trigger; ArrowUp/Down/Home/End; outside click");
  lines.push("- Phase / lots chips: `role=\"status\"` for labelled status");
  lines.push("- Skip link on shell + sign-in; `scroll-padding` for sticky chrome");
  lines.push("- Stat / ticket numbers: `div` grids (no false `dl` nesting)");
  lines.push("- Sticky compliance bar: content `pb-24` so actions are not covered");
  lines.push("- Packet stress slots: readable headline metrics (not raw JSON)");
  lines.push("- Assignment: enable on `short_put_open`; human-readable cycle label");
  lines.push("");
  lines.push("## Keyboard smoke (manual Playwright)", "");
  lines.push("- Home: first Tab → Skip to content (accent outline); Account menu ArrowDown + Escape restores trigger");
  lines.push("- Sign-in: Email → Password → Sign in; practice Continue as Pat shows focus ring");
  lines.push("");
  writeFileSync(REPORT, lines.join("\n"));
  console.log(`\nWrote ${REPORT}`);
  console.log(`Screenshots in ${OUT}`);
}

await main();
