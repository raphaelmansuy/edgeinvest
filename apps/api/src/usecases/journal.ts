// Journal: one ledger, two groupings (quarter, HK year of assessment), annotations, CSV export, audit (E9; docs/09 §6–7).
import { APPROVED } from "@edge/copy";
import type { Tx } from "../ports";
import { problem } from "../problem";
import { verifyAuditChain } from "../adapters/pg";

const PREMIUM_KINDS = ["put_premium", "call_premium"];

export async function getLedger(tx: Tx, group: "quarter" | "hk_yoa", mode?: string) {
  const entries = await tx.sql`
    select e.entry_id, e.mode, e.cycle_id, e.kind, e.amount_usd, e.trade_date::text as trade_date, e.quarter_label, e.hk_year_of_assessment, e.created_at,
           a.hk_note, coalesce(a.badges_of_trade_flag, false) as badges_of_trade_flag
      from app.ledger_entry e left join app.tax_annotation a using (entry_id)
     where (${mode ?? null}::text is null or e.mode::text = ${mode ?? null})
     order by e.trade_date, e.created_at`;
  const key = group === "quarter" ? "quarter_label" : "hk_year_of_assessment";
  const groups = new Map<string, { label: string; premium: number; debits: number; credits: number; rows: number; by_kind: Record<string, number> }>();
  for (const e of entries as Record<string, string>[]) {
    const g = groups.get(e[key]!) ?? { label: e[key]!, premium: 0, debits: 0, credits: 0, rows: 0, by_kind: {} };
    const amt = Number(e.amount_usd);
    g.rows++;
    if (PREMIUM_KINDS.includes(e.kind!)) g.premium += amt;
    if (amt < 0) g.debits += amt; else g.credits += amt;
    g.by_kind[e.kind!] = (g.by_kind[e.kind!] ?? 0) + amt;
    groups.set(e[key]!, g);
  }
  const premium = (entries as { kind: string; amount_usd: string }[]).filter((e) => PREMIUM_KINDS.includes(e.kind)).reduce((a, e) => a + Number(e.amount_usd), 0);
  const round = (x: number) => (Math.round(x * 100) / 100).toFixed(2);
  return {
    group, entries,
    groups: [...groups.values()].map((g) => ({ ...g, premium: round(g.premium), debits: round(g.debits), credits: round(g.credits),
      by_kind: Object.fromEntries(Object.entries(g.by_kind).map(([k, v]) => [k, round(v)])) })),
    premium_received: round(premium),
    quarters: new Set((entries as { quarter_label: string }[]).map((e) => e.quarter_label)).size,
  };
}

export async function annotate(tx: Tx, entryId: string, hkNote: string | null, flag: boolean) {
  const [e] = await tx.sql`select entry_id from app.ledger_entry where entry_id = ${entryId}`;
  if (!e) throw problem("NOT_FOUND", "Ledger entry not found");
  await tx.sql`insert into app.tax_annotation (entry_id, hk_note, badges_of_trade_flag) values (${entryId}, ${hkNote}, ${flag})
               on conflict (entry_id) do update set hk_note = excluded.hk_note, badges_of_trade_flag = excluded.badges_of_trade_flag, updated_at = now()`;
  await tx.audit({ action: "annotation_updated", scr: "SCR-051", payload: { entry: entryId, flag, has_note: Boolean(hkNote) } });
  return { entry_id: entryId, hk_note: hkNote, badges_of_trade_flag: flag };
}

const csvCell = (v: unknown) => {
  const t = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(t) && !/^-?\d/.test(t) ? `'${t}` : t;   // CSV-injection guard, numbers stay numbers
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export async function hkCsv(tx: Tx, yoa?: string) {
  const rows = await tx.sql`
    select e.hk_year_of_assessment, e.trade_date::text as trade_date, e.mode, e.kind, e.amount_usd, e.cycle_id, a.hk_note, coalesce(a.badges_of_trade_flag, false) as flag
      from app.ledger_entry e left join app.tax_annotation a using (entry_id)
     where (${yoa ?? null}::text is null or e.hk_year_of_assessment = ${yoa ?? null})
     order by e.trade_date, e.created_at`;
  const header = ["hk_year_of_assessment", "trade_date_et", "mode", "kind", "amount_usd", "cycle_id", "hk_note", "badges_of_trade_flag"];
  const disclaimer = `# ${APPROVED["tax.not_advice"].replaceAll("**", "")}`;
  const lines = [disclaimer, header.join(","), ...rows.map((r: Record<string, unknown>) =>
    [r.hk_year_of_assessment, r.trade_date, r.mode, r.kind, r.amount_usd, r.cycle_id, r.hk_note, r.flag].map(csvCell).join(","))];
  await tx.audit({ action: "hk_export", scr: "SCR-051", payload: { rows: rows.length, yoa: yoa ?? "all" } });
  return lines.join("\n") + "\n";
}

export async function listAudit(tx: Tx, opts: { before?: number; action?: string; limit: number }) {
  const rows = await tx.sql`
    select seq, action, actor, scr_id, payload, ts, encode(chain_hash, 'hex') as chain_hash
      from app.audit_event
     where (${opts.before ?? null}::bigint is null or seq < ${opts.before ?? null}::bigint)
       and (${opts.action ?? null}::text is null or action = ${opts.action ?? null})
     order by seq desc limit ${opts.limit}`;
  const actions = await tx.sql`select action, count(*)::int as n from app.audit_event group by action order by n desc`;
  return { items: rows, next_before: rows.length === opts.limit ? Number(rows.at(-1).seq) : null, actions };
}

export async function verifyAudit(tx: Tx) {
  const r = await verifyAuditChain(tx);
  return { ...r, verified_at: new Date().toISOString() };
}
