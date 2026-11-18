import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dbName = "study_keyexpiry_test";
const migrationMillis = 1_793_613_756_810; // 0003_key_expiry in drizzle/meta/_journal.json
const base = process.env.DATABASE_URL!;
let admin: ReturnType<typeof postgres>;
let db: ReturnType<typeof postgres>;

const apply = async (name: string) => {
  const sql = await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) await db.unsafe(statement);
};

beforeAll(async () => {
  admin = postgres(base, { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists ${dbName}`);
  await admin.unsafe(`create database ${dbName}`);
  const url = base.replace(/\/[^/?]+(\?.*)?$/, `/${dbName}$1`);
  db = postgres(url, { max: 1, onnotice: () => {} });
  await db.unsafe(`create schema if not exists extensions`);
  await db.unsafe(`create extension if not exists vector with schema extensions`);
  for (const name of ["0000_init", "0001_learning", "0002_profile_activity"]) await apply(name);
  await db.unsafe(`insert into profiles (id, email, display_name, ical_token) values ('11111111-1111-4111-8111-111111111111', 'a@example.org', 'A', 'ical-a')`);
});
afterAll(async () => {
  await db.end();
  await admin.unsafe(`drop database if exists ${dbName}`);
  await admin.end();
});

describe("api token expiry backfill", () => {
  it("bases a pre-existing key's expiry on when it was created", async () => {
    const old = new Date(Date.now() - 80 * 86_400_000);
    await db.unsafe(`insert into api_tokens (user_id, name, token_hash, created_at) values ('11111111-1111-4111-8111-111111111111', 'old', 'hash-old', '${old.toISOString()}')`);
    await apply("0003_key_expiry");

    const [row] = await db.unsafe<{ expires_at: Date }[]>(`select expires_at from api_tokens where token_hash = 'hash-old'`);
    expect(row!.expires_at.getTime()).toBeCloseTo(old.getTime() + 90 * 86_400_000, -4);
  });

  it("corrects databases that already ran the old backfill, without touching extended keys", async () => {
    for (const name of ["0004_deadline_done", "0005_invitations_notifications", "0006_profile_locale", "0007_course_locale", "0008_search_simple"]) await apply(name);
    const old = new Date(Date.now() - 80 * 86_400_000);
    const bad = new Date(migrationMillis + 90 * 86_400_000);
    const extended = new Date(Date.now() + 120 * 86_400_000);
    await db.unsafe(
      `insert into api_tokens (user_id, name, token_hash, created_at, expires_at) values ` +
        `('11111111-1111-4111-8111-111111111111', 'bad', 'hash-bad', '${old.toISOString()}', '${bad.toISOString()}'),` +
        `('11111111-1111-4111-8111-111111111111', 'extended', 'hash-extended', '${new Date(Date.now() - 100 * 86_400_000).toISOString()}', '${extended.toISOString()}')`,
    );
    await apply("0009_key_expiry_backfill");

    const rows = await db.unsafe<{ token_hash: string; expires_at: Date }[]>(`select token_hash, expires_at from api_tokens where token_hash in ('hash-bad', 'hash-extended')`);
    const corrected = rows.find((row) => row.token_hash === "hash-bad")!;
    const untouched = rows.find((row) => row.token_hash === "hash-extended")!;
    expect(corrected.expires_at.getTime()).toBeCloseTo(old.getTime() + 90 * 86_400_000, -4);
    expect(untouched.expires_at.getTime()).toBe(extended.getTime());
  });
});
