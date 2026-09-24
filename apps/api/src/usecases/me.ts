// Identity, capabilities, disclosures, envelope and mode (E0; docs/04 §5, docs/12 §4).
import { ANONYMOUS, type Capabilities, LIVE_PHRASE, OVERRIDE_PHRASE } from "@edge/contracts";
import { COPY_VERSION, DISCLOSURES, EXECUTE_DISCLOSURES, ONBOARDING_DISCLOSURES } from "@edge/copy";
import { ENVELOPES, type EnvelopeId, toDecimalString } from "@edge/domain";
import { sha256, sha256hex } from "../adapters/pg";
import type { Deps, Tx } from "../ports";
import { problem } from "../problem";
import { leftoverOf, loadWheelContext } from "./context";

const SESSION_ABSOLUTE_MS = 30 * 86_400_000;

export async function signIn(d: Deps, email: string, password: string) {
  const [row] = await d.sql`select * from app.auth_lookup(${email})`;
  // Constant work whether or not the user exists (no user enumeration, EC-SEC-001).
  const hash = row?.password_hash ?? "$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$4b1bQJxv1N9gYt2F1c0n5q7X0cVq3Q3P0mJmR6k2m1E";
  const ok = await Bun.password.verify(password, hash).catch(() => false);
  if (!row || !ok) throw problem("INVALID_CREDENTIALS");
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  await d.uow.run(row.user_id, async (tx) => {
    await tx.sql`insert into app.session (token_sha256, user_id, expires_at)
                 values (${sha256(token)}, ${row.user_id}, ${new Date(Date.now() + SESSION_ABSOLUTE_MS)})`;
    await tx.audit({ action: "session_started", scr: "SCR-100", payload: { session: sha256hex(token).slice(0, 16) } });
  });
  return { token, userId: row.user_id as string };
}

export async function signOut(d: Deps, userId: string, sessionHash: Buffer, all: boolean) {
  await d.uow.run(userId, async (tx) => {
    if (all) await tx.sql`update app.session set revoked_at = now() where revoked_at is null`;
    else await tx.sql`update app.session set revoked_at = now() where token_sha256 = ${sessionHash}`;
    await tx.audit({ action: "session_revoked", scr: "SCR-070", payload: { all } });
  });
}

async function ackedKeys(tx: Tx) {
  const rows = await tx.sql`select a.disclosure_key from app.disclosure_ack a join app.app_user u on u.user_id = a.user_id
                             where a.copy_version = ${COPY_VERSION} and a.acked_at >= u.jurisdiction_set_at`;
  return new Set(rows.map((r: { disclosure_key: string }) => r.disclosure_key));
}

export async function computeCapabilities(d: Deps, tx: Tx): Promise<Capabilities> {
  const [u] = await tx.sql`select email, display_name, jurisdiction, account_mode, theme from app.app_user where user_id = ${tx.userId}`;
  if (!u) return ANONYMOUS;
  const w = await loadWheelContext(tx);
  const acked = await ackedKeys(tx);
  const pending = ONBOARDING_DISCLOSURES.filter((k) => !acked.has(k));
  const onboarded = pending.length === 0 && Boolean(u.jurisdiction);
  const liveBlockers = [
    ...(w.masteryAllPass ? [] : ["Pass all six competencies and the paper wheel (Game hub)."]),
    ...EXECUTE_DISCLOSURES.filter((k) => !acked.has(k)).map((k) => `Acknowledge "${DISCLOSURES.find((x) => x.key === k)!.title}".`),
  ];
  const openShortPut = w.openCycles.some((c) => c.state === "short_put_open");
  const agent = await d.llm.status().catch(() => ({ available: false }));
  return {
    authenticated: true,
    onboarded,
    phase: w.phase,
    phase_cash_put: w.phase === "cash-put",
    phase_shares_held: w.phase === "shares-held",
    open_short_put: openShortPut,
    open_cycle: w.openCycles.length > 0,
    open_cycle_id: w.openCycles[0]?.cycle_id ?? null,
    mastery_all_pass: w.masteryAllPass,
    mentor_selectable: w.masteryAllPass,
    live_eligible: liveBlockers.length === 0,
    live_blockers: liveBlockers,
    can_prepare_draft: !w.haltReason && w.account !== null,
    agent_available: agent.available,
    halted: w.haltReason !== null,
    halt_reason: w.haltReason,
    mode: w.mode,
    envelope_id: w.envelopeId,
    envelope_override: w.envelopeOverride,
    lots_open: w.lotsOpen,
    lots_max: w.lotsMax,
    reserved_usd: toDecimalString(w.reservedUsd),
    leftover_usd: toDecimalString(leftoverOf(w)),
    settled_usd: w.account ? toDecimalString(w.account.settled) : null,
    copy_version: COPY_VERSION,
    pending_disclosures: pending,
    user: { email: u.email, display_name: u.display_name, jurisdiction: u.jurisdiction, theme: u.theme },
  };
}

export async function getMe(tx: Tx) {
  const [u] = await tx.sql`select user_id, email, display_name, jurisdiction, locale, voice_profile, account_mode, paper_start_cash, theme, created_at
                             from app.app_user where user_id = ${tx.userId}`;
  if (!u) throw problem("NOT_FOUND");
  const sessions = await tx.sql`select created_at, last_seen_at, expires_at from app.session where revoked_at is null and expires_at > now()
                                 order by last_seen_at desc`;
  return { ...u, sessions };
}

export async function patchMe(tx: Tx, patch: { display_name?: string | null; jurisdiction?: string; paper_start_cash?: string; theme?: string }) {
  const [before] = await tx.sql`select jurisdiction from app.app_user where user_id = ${tx.userId}`;
  const sets: Record<string, unknown> = {};
  if (patch.display_name !== undefined) sets.display_name = patch.display_name;
  if (patch.jurisdiction !== undefined) sets.jurisdiction = patch.jurisdiction;
  if (patch.paper_start_cash !== undefined) sets.paper_start_cash = patch.paper_start_cash;
  if (patch.theme !== undefined) sets.theme = patch.theme;
  // A jurisdiction change resets onboarding: acks older than jurisdiction_set_at no longer count (docs/12 §4).
  const jurChanged = Boolean(patch.jurisdiction && patch.jurisdiction !== before?.jurisdiction);
  if (Object.keys(sets).length) {
    await tx.sql`update app.app_user set ${tx.sql(sets)}, updated_at = now() where user_id = ${tx.userId}`;
  }
  // Same transaction clock as disclosure acks (acked_at >= jurisdiction_set_at). A JS Date can sit ahead of Postgres now().
  if (jurChanged) {
    await tx.sql`update app.app_user set jurisdiction_set_at = now() where user_id = ${tx.userId}`;
  }
  await tx.audit({ action: "profile_updated", scr: "SCR-070", payload: { fields: Object.keys(sets) } });
  return getMe(tx);
}

export async function listDisclosures(tx: Tx) {
  const rows = await tx.sql`select disclosure_key, copy_version, acked_at from app.disclosure_ack order by acked_at`;
  const byKey = new Map(rows.filter((r: { copy_version: string }) => r.copy_version === COPY_VERSION).map((r: { disclosure_key: string; acked_at: Date }) => [r.disclosure_key, r.acked_at]));
  return {
    copy_version: COPY_VERSION,
    disclosures: DISCLOSURES.map((x) => ({ ...x, acked_at: byKey.get(x.key) ?? null })),
    history: rows,
  };
}

export async function ackDisclosure(tx: Tx, key: string, copyVersion: string, scr = "SCR-101") {
  if (!DISCLOSURES.some((x) => x.key === key)) throw problem("NOT_FOUND", `Unknown disclosure ${key}`);
  if (copyVersion !== COPY_VERSION) throw problem("VALIDATION_FAILED", `copy_version must be ${COPY_VERSION}`);
  const current = await ackedKeys(tx);
  if (current.has(key)) return { key, copy_version: copyVersion, replay: true };
  await tx.sql`insert into app.disclosure_ack (user_id, disclosure_key, copy_version, scr_id)
               values (${tx.userId}, ${key}, ${copyVersion}, ${scr})
               on conflict (user_id, disclosure_key, copy_version) do update set acked_at = now(), scr_id = excluded.scr_id`;
  await tx.audit({ action: "disclosure_acked", scr: scr as never, payload: { key, copy_version: copyVersion } });
  return { key, copy_version: copyVersion, replay: false };
}

export async function viewDisclosure(tx: Tx, key: string, scr: string) {
  await tx.audit({ action: "disclosure_viewed", scr: scr as never, payload: { key, copy_version: COPY_VERSION } });
}

export async function selectEnvelope(tx: Tx, envelopeId: EnvelopeId, override: boolean, phrase?: string) {
  const w = await loadWheelContext(tx, { forUpdate: true });
  const env = ENVELOPES[envelopeId];
  let overrideUsed = false;
  if (env.requiresMastery && !w.masteryAllPass) {
    if (!override || phrase !== OVERRIDE_PHRASE) throw problem("CAPABILITY_MISSING", "Mentor needs mastery, or the audited two-step override.");
    overrideUsed = true;
  }
  if (w.envelopeId === envelopeId && w.envelopeOverride === overrideUsed) return { envelope_id: envelopeId, changed: false };
  await tx.sql`update app.envelope_selection set valid_during = tstzrange(lower(valid_during), now())
                where valid_during @> now()`;
  await tx.sql`insert into app.envelope_selection (user_id, envelope_id, valid_during, override_before_mastery)
               values (${tx.userId}, ${envelopeId}, tstzrange(now(), null), ${overrideUsed})`;
  await tx.audit({ action: "envelope_changed", scr: "SCR-071", payload: { from: w.envelopeId, to: envelopeId, override: overrideUsed } });
  if (overrideUsed) await tx.audit({ action: "envelope_override_before_mastery", scr: "SCR-071", payload: { to: envelopeId } });
  return { envelope_id: envelopeId, changed: true };
}

export async function envelopeHistory(tx: Tx) {
  return tx.sql`select envelope_id, lower(valid_during) as valid_from, upper(valid_during) as valid_to, override_before_mastery
                  from app.envelope_selection order by lower(valid_during) desc`;
}

export async function setMode(d: Deps, tx: Tx, mode: "paper" | "live", phrase?: string) {
  const caps = await computeCapabilities(d, tx);
  if (mode === "live") {
    if (!caps.live_eligible) throw problem("CAPABILITY_MISSING", caps.live_blockers.join(" "));
    if (phrase !== LIVE_PHRASE) throw problem("VALIDATION_FAILED", `Type "${LIVE_PHRASE}" to enable Live.`);
    await ackDisclosure(tx, "live.unlock", COPY_VERSION, "SCR-072").catch(() => undefined);
  }
  if (caps.open_cycle) throw problem("ILLEGAL_TRANSITION", "Finish or close the open cycle before switching mode.");
  if (caps.mode === mode) return { mode, changed: false };
  await tx.sql`update app.app_user set account_mode = ${mode}, updated_at = now() where user_id = ${tx.userId}`;
  await tx.audit({ action: "mode_changed", scr: "SCR-072", payload: { from: caps.mode, to: mode } });
  return { mode, changed: true };
}
