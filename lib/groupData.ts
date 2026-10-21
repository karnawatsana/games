import "server-only";
import { createClient } from "./supabase/server";
import { avatarUrl } from "./data";
import { addDays, weekBounds } from "./dates";
import type { ResultRow } from "./stats";

export type Member = { id: string; name: string; username: string; avatarUrl?: string };

/** Members and their results since `from`. Visibility (membership, join date) is enforced by RLS, not here. */
export async function loadGroup(groupId: string, today: string) {
  const sb = await createClient();
  const { data: group } = await sb.from("groups").select("id, name, owner_id").eq("id", groupId).maybeSingle();
  if (!group) return null;
  const { data: mem } = await sb.from("group_members").select("user_id, joined_on, profiles(display_name, username, avatar_path)").eq("group_id", groupId);
  const members: Member[] = (mem ?? []).map((m) => {
    const p = m.profiles as unknown as { display_name: string; username: string; avatar_path: string | null };
    return { id: m.user_id, name: p.display_name, username: p.username, avatarUrl: avatarUrl(p.avatar_path) };
  });
  const from = addDays(weekBounds(today).start, -21);
  const { data: res } = await sb.from("game_results").select("user_id, game_date, score_numeric, score_data, verification_status, completed_at, games(slug, score_direction, max_score, name)")
    .in("user_id", members.map((m) => m.id)).gte("game_date", from);
  type G = { slug: string; score_direction: "higher_better" | "lower_better" | "none"; max_score: number | null; name: string };
  const results = (res ?? []).map((r) => {
    const g = r.games as unknown as G;
    return { user_id: r.user_id, game_slug: g.slug === "krillion" || g.slug === "fermi" ? g.slug : "mystery", game_date: r.game_date, verification: r.verification_status, score_numeric: r.score_numeric, completed_at: r.completed_at, game: g, display: (r.score_data as { display?: string })?.display } as ResultRow & { game: G; display?: string };
  });
  return { group, members, results };
}
