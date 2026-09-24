#!/usr/bin/env bun
// Rebuilds packages/sim/data/* from public market history and writes manifest.json with sha256 per file
// (docs/10 §3, EC-SM-008). Run: bun tools/fetch-datasets.ts  — output is committed; tests verify hashes.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(import.meta.dir, "../packages/sim/data");
const P1 = 915_148_800; // 1999-01-01
const P2 = Math.floor(Date.UTC(2026, 7, 28) / 1000); // 2026-08-28 — dataset cut-off (Mobile article date)
const RETRIEVED = new Date().toISOString();

type Bar = { date: string; close: number; adj: number };
async function yahoo(symbol: string, interval: "1wk" | "1mo"): Promise<{ url: string; bars: Bar[] }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&period1=${P1}&period2=${P2}&includeAdjustedClose=true&events=div`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
  const r = (await res.json()).chart.result[0];
  const close: (number | null)[] = r.indicators.quote[0].close;
  const adj: (number | null)[] = r.indicators.adjclose?.[0]?.adjclose ?? close;
  const bars = (r.timestamp as number[])
    .map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), close: close[i]!, adj: adj[i]! }))
    .filter((b) => Number.isFinite(b.close) && Number.isFinite(b.adj));
  return { url: url.replace(/&period2=\d+/, ""), bars };
}

const round = (x: number, dp = 6) => Math.round(x * 10 ** dp) / 10 ** dp;
const files: Record<string, { path: string; source_urls: string[]; notes: string }> = {};
function emit(name: string, body: unknown, source_urls: string[], notes: string) {
  const path = join(OUT, name);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(body, null, 1)}\n`);
  files[name] = { path, source_urls, notes };
}

const [qqqM, qqqW, vxnW, vixW, irxW, vxnM, irxM] = await Promise.all([
  yahoo("QQQ", "1mo"), yahoo("QQQ", "1wk"), yahoo("^VXN", "1wk"), yahoo("^VIX", "1wk"),
  yahoo("^IRX", "1wk"), yahoo("^VXN", "1mo"), yahoo("^IRX", "1mo"),
]);

// 1) Quarterly total returns for the MC bootstrap: sequential 3-month adjusted-close returns from 2010-03.
const monthly = qqqM.bars.filter((b) => b.date >= "2010-03-01");
const quarterly: { end: string; ret: number }[] = [];
for (let i = 3; i < monthly.length; i += 3) {
  quarterly.push({ end: monthly[i]!.date, ret: round(monthly[i]!.adj / monthly[i - 3]!.adj - 1) });
}
emit("qqq-q-2010-2026-v1.json", {
  id: "qqq-q-2010-2026-v1", underlying: "QQQ", kind: "quarterly_total_return",
  window: { start: monthly[0]!.date, end: quarterly.at(-1)!.end }, n: quarterly.length,
  returns: quarterly.map((q) => q.ret), quarter_ends: quarterly.map((q) => q.end),
  iv_default: 0.22,
}, [qqqM.url], "Dividend-adjusted monthly closes; sequential non-overlapping 3-month returns.");

// 2) Crash replays: weekly QQQ closes with an implied-vol proxy (VXN, or VIX × 1.3 before VXN existed).
const ivAt = (date: string) => {
  const v = [...vxnW.bars].reverse().find((b) => b.date <= date);
  if (v && v.date >= "2001-02-01") return { iv: round(v.close / 100, 4), src: "VXN" };
  const x = [...vixW.bars].reverse().find((b) => b.date <= date)!;
  return { iv: round((x.close * 1.3) / 100, 4), src: "VIX×1.3" };
};
const rfAt = (date: string) => round(([...irxW.bars].reverse().find((b) => b.date <= date)?.close ?? 0) / 100, 5);
const SCENARIOS = [
  { id: "dotcom_2000", title: "Dot-com bust", start: "2000-03-10", end: "2003-03-14",
    narrative: "A cash-maxed book is wrecked; one lot survives but is deep under water for years." },
  { id: "gfc_2008", title: "Global financial crisis", start: "2007-10-26", end: "2009-10-30",
    narrative: "A slow grind lower, then a violent capitulation. Discipline beats hope." },
  { id: "covid_2020", title: "COVID crash", start: "2020-02-14", end: "2020-12-31",
    narrative: "Fast crash and fast rebound: assignment, then covered calls on the way up." },
];
for (const s of SCENARIOS) {
  const w = qqqW.bars.filter((b) => b.date >= s.start && b.date <= s.end);
  const iv = w.map((b) => ivAt(b.date));
  emit(`crash/${s.id}.json`, {
    id: s.id, version: 1, title: s.title, narrative: s.narrative, underlying: "QQQ",
    start: w[0]!.date, end: w.at(-1)!.date, weekly_dates: w.map((b) => b.date),
    weekly_close: w.map((b) => round(b.close, 4)), iv_path: iv.map((x) => x.iv),
    iv_source: [...new Set(iv.map((x) => x.src))], rf: rfAt(s.start),
  }, [qqqW.url, vxnW.url, vixW.url, irxW.url],
  "Split-adjusted weekly QQQ closes (price only). IV proxy = VXN close / 100; before 2001-02 VIX × 1.3 (disclosed).");
}

// 3) Monthly backtest series: QQQ adjusted close + VXN + 13-week T-bill, 2001-02 onward.
const vxnMap = new Map(vxnM.bars.map((b) => [b.date.slice(0, 7), b.close / 100]));
const irxMap = new Map(irxM.bars.map((b) => [b.date.slice(0, 7), b.close / 100]));
const bt = qqqM.bars.filter((b) => b.date >= "2001-02-01" && vxnMap.has(b.date.slice(0, 7)) && irxMap.has(b.date.slice(0, 7)));
emit("qqq-m-2001-2026-v1.json", {
  id: "qqq-m-2001-2026-v1", underlying: "QQQ", kind: "monthly_bs_proxy_inputs", n: bt.length,
  dates: bt.map((b) => b.date), close: bt.map((b) => round(b.adj, 4)),
  iv: bt.map((b) => round(vxnMap.get(b.date.slice(0, 7))!, 4)), rf: bt.map((b) => round(irxMap.get(b.date.slice(0, 7))!, 5)),
}, [qqqM.url, vxnM.url, irxM.url], "Monthly dividend-adjusted close, VXN/100 as IV proxy, ^IRX/100 as annual T-bill rate.");

const { readFileSync } = await import("node:fs");
const manifest = {
  generated_by: "tools/fetch-datasets.ts", retrieved_at: RETRIEVED, cutoff: "2026-08-28",
  licence: "Yahoo Finance public chart data; educational, non-commercial use. Not investment data of record.",
  files: Object.fromEntries(Object.entries(files).map(([name, f]) => [name, {
    sha256: createHash("sha256").update(readFileSync(f.path)).digest("hex"), source_urls: f.source_urls, notes: f.notes,
  }])),
};
writeFileSync(join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(Object.entries(manifest.files).map(([n, f]) => `${n} ${f.sha256.slice(0, 12)}`).join("\n"));
