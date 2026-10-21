"use server";
import { createClient } from "@/lib/supabase/server";
import { productDate } from "@/lib/dates";
import { getMysteryGameRow } from "@/lib/data";
import type { MysteryGame } from "@/lib/types";

/** Records that THIS user revealed today's game. It never changes the global selection. */
export async function revealMystery(): Promise<MysteryGame | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const date = productDate();
  const g = await getMysteryGameRow(date);
  if (!g) return null;
  await sb.from("mystery_reveals").upsert({ user_id: user.id, game_date: date }, { onConflict: "user_id,game_date", ignoreDuplicates: true });
  return { id: g.id, name: g.name, url: g.official_url, description: g.description, category: g.category, estimatedMinutes: g.estimated_minutes };
}
