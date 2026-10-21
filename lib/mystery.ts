import { addDays } from "./dates";

export type PoolGame = { id: string; active: boolean };
export type ScheduleRow = { game_date: string; mystery_game_id: string };
export type PastRow = ScheduleRow;

export type Selection = { gameId: string; source: "scheduled" | "auto" | "fallback" } | null;

/**
 * Pick the mystery game for a calendar date.
 * 1. An explicit schedule row always wins (and is permanent history).
 * 2. Otherwise choose from the active pool, skipping games used in the last `cooldownDays`;
 *    deterministic per date so every caller computes the same answer.
 * 3. Otherwise the explicitly configured fallback (never a random unverified URL).
 * Callers should persist an "auto" result so the day's choice is fixed and recorded.
 */
export function selectMystery(opts: {
  date: string;
  schedule: ScheduleRow[];
  pool: PoolGame[];
  history: PastRow[];
  fallbackId?: string | null;
  cooldownDays?: number;
}): Selection {
  const { date, schedule, pool, history, fallbackId, cooldownDays = 14 } = opts;
  const scheduled = schedule.find((s) => s.game_date === date);
  if (scheduled) return { gameId: scheduled.mystery_game_id, source: "scheduled" };

  const active = pool.filter((g) => g.active).sort((a, b) => a.id.localeCompare(b.id));
  const cutoff = addDays(date, -cooldownDays);
  const recent = new Set(history.filter((h) => h.game_date >= cutoff && h.game_date < date).map((h) => h.mystery_game_id));
  let eligible = active.filter((g) => !recent.has(g.id));
  if (eligible.length === 0) {
    // everything is on cooldown: take the least recently used
    const last = new Map<string, string>();
    for (const h of history) if (!last.has(h.mystery_game_id) || h.game_date > last.get(h.mystery_game_id)!) last.set(h.mystery_game_id, h.game_date);
    eligible = [...active].sort((a, b) => (last.get(a.id) ?? "").localeCompare(last.get(b.id) ?? "")).slice(0, 1);
  }
  if (eligible.length) return { gameId: eligible[hash(date) % eligible.length].id, source: "auto" };
  return fallbackId ? { gameId: fallbackId, source: "fallback" } : null;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
