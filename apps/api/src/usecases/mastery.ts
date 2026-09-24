// Evidence → mastery projection (docs/03 §4). Evidence is append-only; mastery_progress is rebuilt from it (idempotent).
import { COMPETENCIES, MASTERY_RULES, projectMastery } from "@edge/domain";
import type { Tx } from "../ports";

export async function recordEvidence(tx: Tx, rows: { rule: string; passed: boolean }[], sourceRef: string, scr: string) {
  if (!rows.length) return rebuildMastery(tx, scr);
  for (const r of rows) {
    const competency = COMPETENCIES.find((c) => MASTERY_RULES[c].some((x) => x.rule === r.rule));
    if (!competency) continue;
    await tx.sql`insert into app.competency_evidence (user_id, competency, rule_id, source_ref, passed)
                 values (${tx.userId}, ${competency}, ${r.rule}, ${sourceRef}, ${r.passed})`;
  }
  await tx.audit({ action: "evidence_recorded", scr: scr as never, actor: "system", payload: { source: sourceRef, rules: rows.map((r) => `${r.rule}:${r.passed ? "pass" : "fail"}`) } });
  return rebuildMastery(tx, scr);
}

export async function rebuildMastery(tx: Tx, scr = "SCR-007") {
  const ev = await tx.sql`select rule_id, passed from app.competency_evidence`;
  const [mp] = await tx.sql`select paper_wheel_completed_at, all_passed_at from app.mastery_progress where user_id = ${tx.userId}`;
  const m = projectMastery(ev as { rule_id: string; passed: boolean }[], Boolean(mp?.paper_wheel_completed_at));
  const newlyAll = m.allPass && !mp?.all_passed_at;
  await tx.sql`insert into app.mastery_progress (user_id, vocabulary, arithmetic, risk, cash_discipline, strike_selection, management, updated_at)
               values (${tx.userId}, ${m.status.vocabulary}, ${m.status.arithmetic}, ${m.status.risk}, ${m.status.cash_discipline},
                       ${m.status.strike_selection}, ${m.status.management}, now())
               on conflict (user_id) do update set vocabulary = excluded.vocabulary, arithmetic = excluded.arithmetic, risk = excluded.risk,
                 cash_discipline = excluded.cash_discipline, strike_selection = excluded.strike_selection, management = excluded.management,
                 updated_at = now()`;
  if (newlyAll) {
    await tx.sql`update app.mastery_progress set all_passed_at = now() where user_id = ${tx.userId}`;
    await tx.audit({ action: "mastery_unlocked", scr: scr as never, actor: "system", payload: { competencies: [...COMPETENCIES] } });
  }
  return m;
}

export async function getMastery(tx: Tx) {
  const ev = await tx.sql`select rule_id, passed, created_at, source_ref from app.competency_evidence order by created_at desc`;
  const [mp] = await tx.sql`select paper_wheel_completed_at, all_passed_at from app.mastery_progress where user_id = ${tx.userId}`;
  const m = projectMastery(ev as { rule_id: string; passed: boolean }[], Boolean(mp?.paper_wheel_completed_at));
  return {
    all_pass: Boolean(mp?.all_passed_at),
    all_passed_at: mp?.all_passed_at ?? null,
    paper_wheel_completed_at: mp?.paper_wheel_completed_at ?? null,
    competencies: COMPETENCIES.map((c) => ({
      id: c, status: m.status[c], progress: m.progress[c],
      rules: MASTERY_RULES[c].map((r) => ({ ...r, passed: m.passedRules.includes(r.rule), attempts: ev.filter((e: { rule_id: string }) => e.rule_id === r.rule).length })),
    })),
    recent: ev.slice(0, 12),
  };
}
