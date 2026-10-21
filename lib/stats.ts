import { addDays, weekBounds } from "./dates";

export type ResultRow = { user_id: string; game_slug: string; game_date: string; verification: "verified" | "user_confirmed" | "unverified"; score_numeric?: number | null; completed_at?: string };

export const DAILY_GAMES = 3;

/** Distinct games a user completed on a date. A row existing means the user submitted; clicking Play never creates one. */
export function completedOn(rows: ResultRow[], userId: string, date: string): string[] {
  return [...new Set(rows.filter((r) => r.user_id === userId && r.game_date === date).map((r) => r.game_slug))];
}

export const isDailyThree = (rows: ResultRow[], userId: string, date: string) => completedOn(rows, userId, date).length >= DAILY_GAMES;

function dailyThreeDates(rows: ResultRow[], userId: string): Set<string> {
  const byDate = new Map<string, Set<string>>();
  for (const r of rows) if (r.user_id === userId) (byDate.get(r.game_date) ?? byDate.set(r.game_date, new Set()).get(r.game_date)!).add(r.game_slug);
  return new Set([...byDate].filter(([, s]) => s.size >= DAILY_GAMES).map(([d]) => d));
}

/** Streak of consecutive days with ≥1 game played. Today not yet played doesn't break it (grace until the day ends). */
export function activeStreak(rows: ResultRow[], userId: string, today: string): number {
  const days = new Set(rows.filter((r) => r.user_id === userId).map((r) => r.game_date));
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

export function longestStreak(rows: ResultRow[], userId: string): number {
  const days = [...new Set(rows.filter((r) => r.user_id === userId).map((r) => r.game_date))].sort();
  let best = 0, run = 0, prev: string | null = null;
  for (const d of days) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}

export type DailyEntry = { userId: string; completed: number; games: string[]; tied: boolean; rank: number; finishedAt?: string };

/** Daily-3 completion board. Equal completion counts share a rank and are marked tied: no arbitrary ordering implies "better". */
export function dailyBoard(rows: ResultRow[], memberIds: string[], date: string): DailyEntry[] {
  const entries = memberIds.map((userId) => {
    const games = completedOn(rows, userId, date);
    const times = rows.filter((r) => r.user_id === userId && r.game_date === date && r.completed_at).map((r) => r.completed_at!);
    return { userId, completed: games.length, games, finishedAt: games.length >= DAILY_GAMES ? times.sort().at(-1) : undefined };
  });
  entries.sort((a, b) => b.completed - a.completed || a.userId.localeCompare(b.userId));
  return entries.map((e) => {
    const rank = 1 + entries.filter((o) => o.completed > e.completed).length;
    return { ...e, rank, tied: entries.filter((o) => o.completed === e.completed).length > 1 };
  });
}

export type WeeklyEntry = { userId: string; gamesCompleted: number; allThreeDays: number; streak: number; rank: number; tied: boolean };

export function weeklyBoard(rows: ResultRow[], memberIds: string[], today: string): WeeklyEntry[] {
  const { start, end } = weekBounds(today);
  const inWeek = rows.filter((r) => r.game_date >= start && r.game_date <= end);
  const entries = memberIds.map((userId) => ({
    userId,
    gamesCompleted: inWeek.filter((r) => r.user_id === userId).length,
    allThreeDays: [...dailyThreeDates(inWeek, userId)].length,
    streak: activeStreak(rows, userId, today),
  }));
  const key = (e: (typeof entries)[number]) => e.gamesCompleted * 1000 + e.allThreeDays;
  entries.sort((a, b) => key(b) - key(a) || b.streak - a.streak || a.userId.localeCompare(b.userId));
  return entries.map((e) => ({
    ...e,
    rank: 1 + entries.filter((o) => key(o) > key(e) || (key(o) === key(e) && o.streak > e.streak)).length,
    tied: entries.filter((o) => key(o) === key(e) && o.streak === e.streak).length > 1,
  }));
}

export type Direction = "higher_better" | "lower_better" | "none";

/** Rank native scores within ONE game. Different games are never combined. completion_only games return null. */
export function rankGameScores<T extends { userId: string; score: number | null }>(entries: T[], direction: Direction): (T & { rank: number | null })[] | null {
  if (direction === "none") return null;
  const scored = entries.filter((e) => e.score != null) as (T & { score: number })[];
  const better = (a: number, b: number) => (direction === "higher_better" ? a > b : a < b);
  return scored
    .sort((a, b) => (a.score === b.score ? 0 : better(a.score, b.score) ? -1 : 1))
    .map((e) => ({ ...e, rank: 1 + scored.filter((o) => better(o.score, e.score)).length }));
}

export function personalBest(scores: number[], direction: Direction): number | null {
  if (direction === "none" || scores.length === 0) return null;
  return direction === "higher_better" ? Math.max(...scores) : Math.min(...scores);
}

/** Spoiler gate: answers for a game/date are hidden until the viewer has submitted that game for that date. */
export function canSeeAnswers(opts: { viewerId: string; ownerId: string; viewerFinished: boolean; ownerSharesAnswers: boolean; spoilerRevealed?: boolean }): boolean {
  if (opts.viewerId === opts.ownerId) return true;
  if (!opts.ownerSharesAnswers) return false;
  return opts.viewerFinished || !!opts.spoilerRevealed;
}
