import "server-only";
import { createAdminClient, createClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";
import { productDate } from "./dates";
import { activeStreak, type ResultRow } from "./stats";
import { selectMystery } from "./mystery";
import type { DailyState, GameResultSummary, MysteryGame } from "./types";

type GameRow = { id: string; slug: string; name: string; official_url: string; description: string; category: string; estimated_minutes: number; score_type: string; score_direction: string; max_score: number | null; is_permanent: boolean; verified_at: string | null; active: boolean; is_fallback: boolean; mystery_eligible: boolean };

export async function getViewer() {
  if (!supabaseConfigured()) return null;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
  return profile ? { id: user.id, email: user.email ?? "", profile } : null;
}

export const avatarUrl = (path?: string | null) => (path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}` : undefined);

/**
 * The mystery game for a date. Same for everyone: a schedule row is the source of truth; if none exists,
 * the deterministic selector runs and the pick is persisted (first writer wins) so history is permanent.
 * Only verified, active games are ever eligible.
 */
export async function getMysteryGameRow(date: string): Promise<GameRow | null> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("daily_game_schedule").select("mystery_game_id").eq("game_date", date).maybeSingle();
  let gameId = existing?.mystery_game_id as string | undefined;
  if (!gameId) {
    const [{ data: pool }, { data: history }, { data: fb }] = await Promise.all([
      admin.from("games").select("id, active").eq("mystery_eligible", true).eq("active", true).not("verified_at", "is", null),
      admin.from("daily_game_schedule").select("game_date, mystery_game_id").lt("game_date", date).order("game_date", { ascending: false }).limit(60),
      admin.from("games").select("id").eq("is_fallback", true).eq("active", true).not("verified_at", "is", null).maybeSingle(),
    ]);
    const pick = selectMystery({ date, schedule: [], pool: pool ?? [], history: history ?? [], fallbackId: fb?.id });
    if (!pick) return null;
    await admin.from("daily_game_schedule").upsert({ game_date: date, mystery_game_id: pick.gameId, source: pick.source }, { onConflict: "game_date", ignoreDuplicates: true });
    const { data: again } = await admin.from("daily_game_schedule").select("mystery_game_id").eq("game_date", date).single();
    gameId = again?.mystery_game_id;
  }
  if (!gameId) return null;
  const { data } = await admin.from("games").select("*").eq("id", gameId).single();
  return data as GameRow | null;
}

const toMystery = (g: GameRow): MysteryGame => ({ id: g.id, name: g.name, url: g.official_url, description: g.description, category: g.category, estimatedMinutes: g.estimated_minutes });

function summarize(row: { score_data: Record<string, unknown>; score_numeric: number | null; verification_status: string } | undefined, game: Pick<GameRow, "score_type" | "max_score" | "slug">): GameResultSummary {
  if (!row) return { completed: false };
  const v = row.verification_status as GameResultSummary["verification"];
  if (game.slug === "krillion" && row.score_numeric != null) return { completed: true, scoreLabel: String(row.score_numeric), scoreSuffix: `/ ${game.max_score ?? 700}`, verification: v };
  if (game.score_type === "multiplier" && row.score_data?.display) return { completed: true, scoreLabel: String(row.score_data.display), scoreSuffix: "error", verification: v };
  if (row.score_numeric != null && game.score_type !== "completion_only") return { completed: true, scoreLabel: String(row.score_numeric), verification: v };
  return { completed: true, verification: v };
}

export async function getDailyState(): Promise<DailyState> {
  const date = productDate();
  const empty: DailyState = { date, user: null, krillion: { completed: false }, fermi: { completed: false }, mystery: { available: false, game: null, revealed: false, result: { completed: false } }, groups: [] };
  const viewer = await getViewer();
  if (!viewer) return empty;

  const sb = await createClient();
  const mysteryRow = await getMysteryGameRow(date).catch(() => null);
  const [{ data: games }, { data: mine }, { data: reveal }, { data: memberships }] = await Promise.all([
    sb.from("games").select("id, slug, score_type, max_score"),
    sb.from("game_results").select("game_id, game_date, score_data, score_numeric, verification_status").eq("user_id", viewer.id).gte("game_date", productDate(new Date(Date.now() - 400 * 864e5))),
    sb.from("mystery_reveals").select("game_date").eq("user_id", viewer.id).eq("game_date", date).maybeSingle(),
    sb.from("group_members").select("group_id, groups(id, name)").eq("user_id", viewer.id),
  ]);
  const gid = (slug: string) => games?.find((g) => g.slug === slug);
  const today = (id?: string) => mine?.find((r) => r.game_date === date && r.game_id === id);
  const k = gid("krillion"), f = gid("fermi");
  const rows: ResultRow[] = (mine ?? []).map((r) => ({ user_id: viewer.id, game_slug: games?.find((g) => g.id === r.game_id)?.slug ?? "?", game_date: r.game_date, verification: r.verification_status }));

  const mysteryResult = mysteryRow ? summarize(today(mysteryRow.id), mysteryRow) : { completed: false };
  const revealed = !!reveal || mysteryResult.completed;

  const groups: DailyState["groups"] = [];
  for (const m of memberships ?? []) {
    const g = m.groups as unknown as { id: string; name: string } | null;
    if (!g) continue;
    const [{ data: members }, { data: res }] = await Promise.all([
      sb.from("group_members").select("user_id, profiles(display_name, avatar_path)").eq("group_id", g.id),
      sb.from("game_results").select("user_id").eq("game_date", date),
    ]);
    groups.push({
      id: g.id, name: g.name,
      members: (members ?? []).map((mm) => {
        const p = mm.profiles as unknown as { display_name: string; avatar_path: string | null } | null;
        return { id: mm.user_id, name: p?.display_name ?? "Player", avatarUrl: avatarUrl(p?.avatar_path), completed: (res ?? []).filter((r) => r.user_id === mm.user_id).length };
      }),
    });
  }

  return {
    date,
    user: { name: viewer.profile.display_name, avatarUrl: avatarUrl(viewer.profile.avatar_path), streak: activeStreak(rows, viewer.id, date) },
    krillion: k ? summarize(today(k.id), { ...k, slug: "krillion" }) : { completed: false },
    fermi: f ? summarize(today(f.id), { ...f, slug: "fermi" }) : { completed: false },
    mystery: { available: !!mysteryRow, game: revealed && mysteryRow ? toMystery(mysteryRow) : null, revealed, result: mysteryResult },
    groups,
  };
}
