// Learn: curriculum, quizzes, flash cards, arithmetic tickets, serious game (E1/E5; docs/03).
import {
  CONTENT_VERSION, MODULES, PASS_THRESHOLD, QUIZZES, REMEDIATION, SEVEN_WORDS, arithmeticTicket, gradeQuiz, gradeTicket, gradeVocab,
  moduleBySlug, publicItems, quizItems, vocabRun,
} from "@edge/content";
import { CRASH_GAMES, type Decision, GAME_SCENARIOS, type GameMode, GameInputError, replayGame } from "@edge/content/game";
import type { Tx } from "../ports";
import { problem } from "../problem";
import { recordEvidence } from "./mastery";

const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]! & 0x7fffffff;

export function getCurriculum(slug: string) {
  const m = moduleBySlug(slug);
  if (!m) throw problem("NOT_FOUND", `Unknown module ${slug}`);
  return { ...m, content_version: CONTENT_VERSION };
}
export const listModules = () => MODULES.map(({ code, slug, title, lead, scr }) => ({ code, slug, title, lead, scr, quiz: code in QUIZZES }));

export async function getQuiz(tx: Tx, module: string) {
  const def = QUIZZES[module];
  if (!def) throw problem("NOT_FOUND", `No quiz for ${module}`);
  const seed = newSeed();
  const attempts = await tx.sql`select attempt_id, score_pct, passed, answers->'missed_tags' as missed_tags, answers->'remediated' as remediated, created_at
                                  from app.quiz_attempt where module_code = ${module} order by created_at desc limit 10`;
  const last = attempts[0];
  const needs = last && !last.passed ? ((last.missed_tags ?? []) as string[]).filter((t) => !((last.remediated ?? []) as string[]).includes(t)) : [];
  return {
    module, title: def.title, seed, pass_threshold: PASS_THRESHOLD, items: publicItems(quizItems(module, seed)), attempts,
    remediation_required: needs.map((t) => REMEDIATION[t]).filter(Boolean),
    last_attempt_id: last?.attempt_id ?? null,
  };
}

export async function openRemediation(tx: Tx, attemptId: string, tag: string) {
  const [a] = await tx.sql`select answers from app.quiz_attempt where attempt_id = ${attemptId}`;
  if (!a) throw problem("NOT_FOUND");
  const rem = new Set<string>((a.answers.remediated ?? []) as string[]);
  rem.add(tag);
  await tx.sql`update app.quiz_attempt set answers = jsonb_set(answers, '{remediated}', ${JSON.stringify([...rem])}::jsonb) where attempt_id = ${attemptId}`;
  return { remediated: [...rem] };
}

export async function submitQuiz(tx: Tx, module: string, seed: number, answers: Record<string, string>) {
  const def = QUIZZES[module];
  if (!def) throw problem("NOT_FOUND", `No quiz for ${module}`);
  const [last] = await tx.sql`select passed, answers from app.quiz_attempt where module_code = ${module} order by created_at desc limit 1`;
  if (last && !last.passed) {
    const open = ((last.answers.missed_tags ?? []) as string[]).filter((t) => !((last.answers.remediated ?? []) as string[]).includes(t));
    if (open.length) throw problem("CAPABILITY_MISSING", `Open the remediation card(s) first: ${open.join(", ")}`);
  }
  const g = gradeQuiz(module, seed, answers);
  const [row] = await tx.sql`insert into app.quiz_attempt (user_id, module_code, content_version, score_pct, answers)
                              values (${tx.userId}, ${module}, ${CONTENT_VERSION}, ${g.score},
                                      ${{ seed, given: answers, missed_tags: g.missedTags, remediated: [] }})
                              returning attempt_id, passed`;
  const evidence: { rule: string; passed: boolean }[] = [];
  if (def.rule) evidence.push({ rule: def.rule, passed: g.passed });
  const byItemRule = new Map<string, boolean>();
  for (const r of g.results) if (r.itemRule) byItemRule.set(r.itemRule, (byItemRule.get(r.itemRule) ?? true) && r.correct);
  for (const [rule, passed] of byItemRule) evidence.push({ rule, passed });
  await tx.audit({ action: "quiz_graded", scr: "SCR-006", payload: { module, score: g.score, passed: g.passed, seed } });
  const mastery = await recordEvidence(tx, evidence, `quiz:${row.attempt_id}`, "SCR-006");
  return { attempt_id: row.attempt_id, ...g, remediation: g.passed ? [] : g.missedTags.map((t) => REMEDIATION[t]).filter(Boolean), mastery: mastery.status };
}

export const getVocabRun = () => { const seed = newSeed(); return { seed, cards: vocabRun(seed), total: SEVEN_WORDS.length }; };
export async function submitVocab(tx: Tx, seed: number, answers: Record<string, string>) {
  const g = gradeVocab(answers);
  await tx.audit({ action: "quiz_graded", scr: "SCR-002", payload: { module: "M1-flash", correct: g.correct, seed } });
  await recordEvidence(tx, [{ rule: "vocab.flash_6of7", passed: g.passed }], `flash:${seed}`, "SCR-002");
  return g;
}

export const getTicket = () => arithmeticTicket(newSeed());
export async function submitTicket(tx: Tx, seed: number, answers: Record<string, string>) {
  const g = gradeTicket(seed, answers);
  await tx.sql`insert into app.competency_evidence (user_id, competency, rule_id, source_ref, passed)
               values (${tx.userId}, 'arithmetic', 'arith.ticket', ${`ticket:${seed}`}, ${g.passed})`;
  const [c] = await tx.sql`select count(distinct source_ref)::int as n from app.competency_evidence where rule_id = 'arith.ticket' and passed`;
  const distinct = c?.n ?? 0;
  const [done] = await tx.sql`select 1 from app.competency_evidence where rule_id = 'arith.three_tickets' and passed limit 1`;
  if (distinct >= 3 && !done) await recordEvidence(tx, [{ rule: "arith.three_tickets", passed: true }], `tickets:${distinct}`, "SCR-004");
  await tx.audit({ action: "quiz_graded", scr: "SCR-004", payload: { module: "M3-ticket", seed, passed: g.passed } });
  return { ...g, distinct_passed: distinct, needed: 3 };
}

// ---------------------------------------------------------------- serious game
export function gameCatalog() {
  return {
    scenarios: GAME_SCENARIOS.map(({ id, mode, title, narrative }) => ({ id, mode, title, narrative })),
    crashes: CRASH_GAMES,
  };
}

async function startCash(tx: Tx) {
  const [u] = await tx.sql`select paper_start_cash from app.app_user where user_id = ${tx.userId}`;
  return Number(u?.paper_start_cash ?? 100000);
}

function replay(mode: GameMode, scenarioId: string, seed: number, decisions: Decision[], cash: number) {
  try {
    return replayGame(mode, scenarioId, seed, decisions, { startCashUsd: cash });
  } catch (e) {
    if (e instanceof GameInputError) throw e.message === "UNKNOWN_SCENARIO" ? problem("UNKNOWN_SCENARIO") : problem("VALIDATION_FAILED", e.message);
    throw e;
  }
}

export async function startGame(tx: Tx, mode: GameMode, scenarioId: string) {
  const seed = newSeed();
  const view = replay(mode, scenarioId, seed, [], await startCash(tx));
  const [row] = await tx.sql`insert into app.game_attempt (user_id, scenario_id, scenario_version, mode, seed, graded)
                              values (${tx.userId}, ${scenarioId}, ${CONTENT_VERSION}, ${mode}, ${seed}, ${mode !== "tutorial"})
                              returning attempt_id`;
  return { attempt_id: row.attempt_id as string, view };
}

export async function getGame(tx: Tx, id: string) {
  const [a] = await tx.sql`select * from app.game_attempt where attempt_id = ${id}`;
  if (!a) throw problem("NOT_FOUND");
  return { attempt_id: id, view: replay(a.mode, a.scenario_id, Number(a.seed), a.decisions, await startCash(tx)), finished_at: a.finished_at };
}

export async function stepGame(tx: Tx, id: string, decision: Decision) {
  const [a] = await tx.sql`select * from app.game_attempt where attempt_id = ${id} for update`;
  if (!a) throw problem("NOT_FOUND");
  if (a.finished_at) throw problem("ILLEGAL_TRANSITION", "This attempt is finished. Start a new one.");
  const decisions = [...(a.decisions as Decision[]), decision];
  const view = replay(a.mode, a.scenario_id, Number(a.seed), decisions, await startCash(tx));
  const scr = { tutorial: "SCR-008", scenario: "SCR-009", paper_lab: "SCR-009", crash: "SCR-010", committee: "SCR-011", post_assign: "SCR-012" }[a.mode as GameMode];
  await tx.sql`update app.game_attempt set decisions = ${decisions} where attempt_id = ${id}`;
  if (view.finished) {
    await tx.sql`update app.game_attempt set finished_at = now(), rubric = ${view.rubric ?? null}, process_score = ${view.rubric?.score ?? null}
                 where attempt_id = ${id}`;
    if (view.paperWheelCompleted) {
      await tx.sql`insert into app.mastery_progress (user_id, paper_wheel_completed_at) values (${tx.userId}, now())
                   on conflict (user_id) do update set paper_wheel_completed_at = coalesce(app.mastery_progress.paper_wheel_completed_at, now())`;
    }
    await tx.audit({ action: "game_graded", scr: scr as never, payload: { attempt: id, mode: a.mode, scenario: a.scenario_id, score: view.rubric?.score ?? null } });
    if (a.graded) await recordEvidence(tx, view.evidence, `game:${id}`, scr);
  }
  return { attempt_id: id, view };
}

export async function listGames(tx: Tx) {
  return tx.sql`select attempt_id, mode, scenario_id, process_score, started_at, finished_at from app.game_attempt order by started_at desc limit 30`;
}

export async function listLessons(tx: Tx) {
  const quizzes = await tx.sql`select attempt_id as id, 'quiz' as kind, module_code as ref, score_pct as score, passed, answers->'missed_tags' as tags, created_at
                                 from app.quiz_attempt order by created_at desc limit 50`;
  const games = await tx.sql`select attempt_id as id, 'game' as kind, mode || ':' || scenario_id as ref, process_score as score, rubric, finished_at as created_at
                               from app.game_attempt where finished_at is not null order by finished_at desc limit 50`;
  const skips = await tx.sql`select m.memo_id as id, 'skip' as kind, s.code as ref, s.note, s.created_at from app.memo_skip s join app.decision_memo m using (memo_id)
                               order by s.created_at desc limit 50`;
  const tags = new Map<string, number>();
  for (const q of quizzes as { tags: string[] | null }[]) for (const t of q.tags ?? []) tags.set(t, (tags.get(t) ?? 0) + 1);
  return {
    items: [...quizzes, ...games, ...skips].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    misconceptions: [...tags].map(([id, count]) => ({ ...REMEDIATION[id]!, count })).sort((a, b) => b.count - a.count),
  };
}
