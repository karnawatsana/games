import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { beforeAll, describe, expect, it } from "vitest";

// Runs the real migrations (0001, 0002, 0004) against Postgres with minimal Supabase auth stubs.
const A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b", C = "00000000-0000-0000-0000-00000000000c";
let db: PGlite; let krillion: string, fermi: string; let group: string; let token = "tok-secret-1";

const as = async <T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) => {
  await db.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try { return (await db.query<T>(sql, params)).rows; } finally { await db.exec("reset role"); }
};
const asErr = async (uid: string, sql: string, params: unknown[] = []) => { try { await as(uid, sql, params); return null; } catch (e) { return (e as Error).message; } };

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create extension if not exists pgcrypto;`);
  for (const f of ["0001_schema", "0002_rls", "0004_extraction_quota"]) await db.exec(readFileSync(`supabase/migrations/${f}.sql`, "utf8"));
  await db.exec(`grant usage on schema public, auth to authenticated, anon; grant all on all tables in schema public to authenticated; grant select on all tables in schema public to anon;
    grant execute on all functions in schema public to authenticated, anon; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated, anon;`);
  for (const [id, n] of [[A, "alice"], [B, "bob"], [C, "carol"]]) await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1,$2,$3)", [id, `${n}@x.test`, JSON.stringify({ username: n, display_name: n })]);
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  krillion = (await db.query<{ id: string }>("select id from games where slug='krillion'")).rows[0].id;
  fermi = (await db.query<{ id: string }>("select id from games where slug='fermi'")).rows[0].id;

  group = (await as<{ create_group: string }>(A, "select create_group('Crew') as create_group"))[0].create_group as unknown as string;
  await db.query("insert into group_invites (group_id, token_hash, expires_at, created_by) values ($1, encode(digest($2,'sha256'),'hex'), now() + interval '1 day', $3)", [group, token, A]);
  await db.query("insert into group_invites (group_id, token_hash, expires_at, created_by) values ($1, encode(digest('old','sha256'),'hex'), now() - interval '1 day', $2)", [group, A]);
  await as(B, "select join_group_with_token($1)", [token]);
  // Results: A has one old (before B joined), one current; B has one current. C is an outsider.
  await db.exec(`update group_members set joined_on = '2026-10-10' where user_id = '${A}'; update group_members set joined_on = '2026-10-15' where user_id = '${B}';`);
  const ins = (u: string, g: string, d: string, s: number) => db.query("insert into game_results (user_id, game_id, game_date, score_numeric, submission_method, verification_status) values ($1,$2,$3,$4,'manual','user_confirmed') returning id", [u, g, d, s]);
  await ins(A, krillion, "2026-10-12", 100);                       // before B joined
  const a1 = (await ins(A, krillion, "2026-10-20", 310)).rows[0] as { id: string };
  const b1 = (await ins(B, fermi, "2026-10-20", 2.4)).rows[0] as { id: string };
  await ins(C, krillion, "2026-10-20", 500);
  for (let n = 1; n <= 7; n++) await db.query("insert into krillion_answers (game_result_id, question_number, question_text, answer_text, points) values ($1,$2,'Q','ans',10)", [a1.id, n]);
  void b1;
});

describe("group membership & result visibility (RLS)", () => {
  it("outsiders can't see the group, members or results", async () => {
    expect(await as(C, "select id from groups")).toHaveLength(0);
    expect(await as(C, "select user_id from group_members")).toHaveLength(0);
    const rows = await as<{ user_id: string }>(C, "select user_id from game_results");
    expect(rows.map((r) => r.user_id)).toEqual([C]);
  });
  it("members see each other's results from after joining, not earlier history", async () => {
    const rows = await as<{ score_numeric: string }>(B, "select score_numeric from game_results where user_id = $1 order by game_date", [A]);
    expect(rows.map((r) => Number(r.score_numeric))).toEqual([310]); // the 2026-10-12 result stays hidden from B
  });
  it("the owner still sees their own full history", async () => expect(await as(A, "select 1 from game_results where user_id = $1", [A])).toHaveLength(2));
  it("users can't edit or delete anyone else's result", async () => {
    await as(B, "update game_results set score_numeric = 999 where user_id = $1", [A]);
    await as(B, "delete from game_results where user_id = $1", [A]);
    expect((await db.query<{ n: string }>("select score_numeric as n from game_results where user_id = $1 and game_date = '2026-10-20'", [A])).rows[0].n).toBe("310");
  });
  it("users can't insert a result as someone else", async () => {
    expect(await asErr(B, "insert into game_results (user_id, game_id, game_date, submission_method, verification_status) values ($1,$2,'2026-10-19','manual','user_confirmed')", [A, fermi])).toMatch(/row-level security/);
  });
  it("one canonical result per user/game/date", async () => {
    expect(await asErr(A, "insert into game_results (user_id, game_id, game_date, submission_method, verification_status) values ($1,$2,'2026-10-20','manual','user_confirmed')", [A, krillion])).toMatch(/duplicate key/);
  });
  it("outsiders can't join groups directly or insert themselves into members", async () => {
    expect(await asErr(C, "insert into group_members (group_id, user_id) values ($1,$2)", [group, C])).toMatch(/row-level security/);
  });
});

describe("invites", () => {
  it("valid token joins once; expired and unknown tokens are refused", async () => {
    expect(await asErr(C, "select join_group_with_token('old')")).toMatch(/invalid or expired/);
    expect(await asErr(C, "select join_group_with_token('nope')")).toMatch(/invalid or expired/);
  });
  it("only the owner can read or create invites", async () => {
    expect(await as(B, "select id from group_invites")).toHaveLength(0);
    expect((await as(A, "select id from group_invites")).length).toBeGreaterThan(0);
    expect(await asErr(B, "insert into group_invites (group_id, token_hash, expires_at, created_by) values ($1,'x', now(), $2)", [group, B])).toMatch(/row-level security/);
  });
  it("raw tokens are never stored", async () => expect((await db.query("select 1 from group_invites where token_hash = $1", [token])).rows).toHaveLength(0));
});

describe("krillion spoiler rules (RLS)", () => {
  it("answers are hidden from a member who hasn't submitted Krillion that day", async () => {
    expect(await as(B, "select 1 from krillion_answers")).toHaveLength(0);
  });
  it("a score-only submission unlocks answers for that date", async () => {
    await db.query("insert into game_results (user_id, game_id, game_date, score_numeric, submission_method, verification_status) values ($1,$2,'2026-10-20',250,'share_text','verified')", [B, krillion]);
    expect(await as(B, "select 1 from krillion_answers")).toHaveLength(7);
  });
  it("respects the owner's share_answers privacy setting", async () => {
    await db.query("update profiles set share_answers = false where id = $1", [A]);
    expect(await as(B, "select 1 from krillion_answers")).toHaveLength(0);
    expect(await as(A, "select 1 from krillion_answers")).toHaveLength(7); // owner always sees
    await db.query("update profiles set share_answers = true where id = $1", [A]);
  });
  it("outsiders never see answers even after playing", async () => expect(await as(C, "select 1 from krillion_answers")).toHaveLength(0));
  it("can't write answers onto someone else's result", async () => {
    const rid = (await db.query<{ id: string }>("select id from game_results where user_id = $1 and game_date = '2026-10-20'", [A])).rows[0].id;
    expect(await asErr(B, "insert into krillion_answers (game_result_id, question_number, question_text, answer_text, points) values ($1,1,'q','a',10)", [rid])).toMatch(/row-level security|duplicate/);
  });
});

describe("screenshots, activity, profiles", () => {
  it("screenshots are private to their owner", async () => {
    const rid = (await db.query<{ id: string }>("select id from game_results where user_id = $1 limit 1", [A])).rows[0].id;
    await db.query("insert into result_screenshots (game_result_id, user_id, storage_path) values ($1,$2,'a/x.png')", [rid, A]);
    expect(await as(B, "select 1 from result_screenshots")).toHaveLength(0);
    expect(await as(A, "select 1 from result_screenshots")).toHaveLength(1);
  });
  it("activity feed is visible to members only and carries no answers/scores", async () => {
    expect((await as(B, "select 1 from group_activity where group_id = $1", [group])).length).toBeGreaterThan(0);
    expect(await as(C, "select 1 from group_activity")).toHaveLength(0);
    const cols = (await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_name='group_activity'")).rows.map((r) => r.column_name);
    expect(cols).not.toEqual(expect.arrayContaining(["score_data"]));
  });
  it("profiles are visible within shared groups, hidden otherwise", async () => {
    expect((await as(B, "select id from profiles")).map((r) => (r as { id: string }).id).sort()).toEqual([A, B]);
    expect((await as(C, "select id from profiles")).map((r) => (r as { id: string }).id)).toEqual([C]);
  });
  it("users can only update their own profile", async () => {
    await as(B, "update profiles set display_name = 'hacked' where id = $1", [A]);
    expect((await db.query<{ display_name: string }>("select display_name from profiles where id = $1", [A])).rows[0].display_name).toBe("alice");
  });
});

describe("mystery schedule & games", () => {
  it("only one mystery game per date", async () => {
    const g = (await db.query<{ id: string }>("select id from games where slug='timeguessr'")).rows[0].id;
    await db.query("insert into daily_game_schedule (game_date, mystery_game_id) values ('2026-10-01', $1)", [g]);
    await expect(db.query("insert into daily_game_schedule (game_date, mystery_game_id) values ('2026-10-01', $1)", [g])).rejects.toThrow(/duplicate key/);
  });
  it("unverified candidate games are seeded inactive", async () => expect((await db.query("select 1 from games where mystery_eligible and (active or verified_at is not null)")).rows).toHaveLength(0));
  it("completion-only games must have no score direction", async () => {
    await expect(db.query("insert into games (slug,name,official_url,description,category,estimated_minutes,score_type,score_direction) values ('z','z','https://z','z','z',3,'completion_only','higher_better')")).rejects.toThrow(/completion_has_no_direction/);
  });
  it("anonymous users can read nothing", async () => expect(await as(null, "select 1 from game_results")).toHaveLength(0));
});
