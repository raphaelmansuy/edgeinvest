#!/usr/bin/env bun
// Creates the single personal-book user (no public sign-up in MVP, docs/12 §8) plus its aggregate rows.
// `SEED_FIXTURES=1` additionally loads the e2e personas (e2e/fixtures/personas.ts).
import { SQL } from "bun";
import { ownerUrl } from "./db-url";

export async function ensureUser(sql: SQL, email: string, password: string, displayName: string | null = null): Promise<string> {
  const hash = await Bun.password.hash(password, { algorithm: "argon2id" });
  const [u] = await sql`
    insert into app.app_user (email, display_name) values (${email}, ${displayName})
    on conflict (lower(email)) where deleted_at is null do update set display_name = coalesce(excluded.display_name, app.app_user.display_name)
    returning user_id`;
  const userId = u.user_id as string;
  await sql`insert into app.credential (user_id, password_hash) values (${userId}, ${hash})
            on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`;
  await sql`insert into app.wheel_state (user_id) values (${userId}) on conflict do nothing`;
  await sql`insert into app.mastery_progress (user_id) values (${userId}) on conflict do nothing`;
  await sql`insert into app.envelope_selection (user_id, envelope_id, valid_during)
            select ${userId}, 'beginner_v1', tstzrange(now(), null)
             where not exists (select 1 from app.envelope_selection where user_id = ${userId})`;
  return userId;
}

export async function seed(sql: SQL) {
  const email = process.env.SEED_USER_EMAIL;
  const password = process.env.SEED_USER_PASSWORD;
  if (email && password) {
    await ensureUser(sql, email, password);
    console.log(`seeded user ${email}`);
  }
  if (process.env.SEED_FIXTURES === "1") {
    const { seedPersonas } = await import("../e2e/fixtures/personas");
    await seedPersonas(sql);
  }
}

if (import.meta.main) {
  const sql = new SQL(ownerUrl());
  await seed(sql).finally(() => sql.close());
}
