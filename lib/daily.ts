import { productDate } from "./dates";
import type { DailyState } from "./types";

/** Signed-out / unconfigured state. Real data is loaded from Supabase once wired (see lib/supabase). */
export async function getDailyState(): Promise<DailyState> {
  return {
    date: productDate(),
    user: null,
    krillion: { completed: false },
    fermi: { completed: false },
    mystery: { game: null, revealed: false, result: { completed: false } },
    groups: [],
  };
}
