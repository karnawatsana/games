"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addDays, productDate } from "@/lib/dates";
import { getMysteryGameRow } from "@/lib/data";
import { ExtractionSchema, KRILLION_MAX_TOTAL } from "@/lib/krillion/schema";
import { hasBlockingIssues, validateExtraction } from "@/lib/krillion/validate";
import { parseKrillionShare } from "@/lib/krillion/shareText";
import { parseFermiShare } from "@/lib/fermi/parse";
import { checkFermi, FermiExtractionSchema } from "@/lib/fermi/schema";
import { mergeResult, type Verification } from "@/lib/results/merge";

const Input = z.object({
  game: z.enum(["krillion", "fermi", "mystery"]),
  gameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.enum(["share_text", "screenshot", "manual"]),
  rawText: z.string().max(4000).optional(),
  score: z.number().min(0).optional(),            // krillion total / fermi numeric multiplier / mystery native score
  scoreDisplay: z.string().max(40).optional(),    // exact representation to keep, e.g. "2.4x"
  extraction: ExtractionSchema.optional(),
  fermiExtraction: FermiExtractionSchema.optional(),
  screenshotPath: z.string().max(200).optional(),
});
export type SaveInput = z.infer<typeof Input>;
export type SaveResult = { ok: true; status: "created" | "enriched" | "corrected" | "unchanged" } | { ok: false; error: string };

export async function saveResult(raw: SaveInput): Promise<SaveResult> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "That submission isn't valid." };
  const i = parsed.data;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const today = productDate();
  if (i.gameDate > today) return { ok: false, error: "That date is in the future." };
  if (i.gameDate < addDays(today, -14)) return { ok: false, error: "Results can be added for the last 14 days." };

  const { data: profile } = await sb.from("profiles").select("username").eq("id", user.id).single();

  // Resolve the game row for this date.
  let gameId: string | undefined;
  if (i.game === "mystery") gameId = (await getMysteryGameRow(i.gameDate))?.id;
  else gameId = (await sb.from("games").select("id").eq("slug", i.game).maybeSingle()).data?.id;
  if (!gameId) return { ok: false, error: i.game === "mystery" ? "No mystery game was scheduled for that day." : "Unknown game." };

  let score_data: Record<string, unknown> = {};
  let score_numeric: number | null = null;
  let verification: Verification = "user_confirmed";
  let answers: z.infer<typeof ExtractionSchema>["answers"] = [];

  if (i.game === "krillion") {
    if (i.method === "screenshot") {
      if (!i.extraction) return { ok: false, error: "Missing extracted answers." };
      const { issues } = validateExtraction(i.extraction, { username: profile?.username });
      const blocking = issues.filter((x) => x.severity === "error");
      if (blocking.length) return { ok: false, error: blocking[0].message };
      score_numeric = i.extraction.totalScore!;
      answers = i.extraction.answers;
      score_data = { total: score_numeric, gameId: i.extraction.gameId, player: i.extraction.playerHandle };
      verification = "verified";
    } else {
      const s = i.score;
      if (s == null || !Number.isInteger(s) || s < 0 || s > KRILLION_MAX_TOTAL) return { ok: false, error: `Score must be a whole number from 0 to ${KRILLION_MAX_TOTAL}.` };
      score_numeric = s;
      score_data = { total: s };
      // Verified only when the pasted text itself yields the same score; otherwise the user typed it.
      const p = i.rawText ? parseKrillionShare(i.rawText) : null;
      verification = i.method === "share_text" && p?.recognized && p.totalScore === s ? "verified" : "user_confirmed";
      if (i.method === "manual") verification = "user_confirmed";
    }
  } else if (i.game === "fermi") {
    if (i.method === "screenshot") {
      const x = i.fermiExtraction;
      if (!x || x.score == null) return { ok: false, error: "We couldn't read a score from that card. Enter it by hand." };
      score_numeric = x.score;
      score_data = { multiplier: x.score, display: `${x.score}×`, topPercent: x.topPercent, puzzleNumber: x.puzzleNumber, questions: x.questions, direction: "lower_is_better" };
      verification = checkFermi(x).length === 0 ? "verified" : "user_confirmed";
    } else {
      const p = i.rawText ? parseFermiShare(i.rawText) : null;
      const typed = i.score ?? (i.scoreDisplay ? Number.parseFloat(i.scoreDisplay) : undefined);
      if (p?.recognized && p.overall && (typed == null || typed === p.overall.value)) {
        // The pasted text itself yields this score: record everything the share contains.
        score_numeric = p.overall.value;
        score_data = { multiplier: p.overall.value, display: p.overall.display, topPercent: p.topPercent, puzzleNumber: p.puzzleNumber, questions: p.questions, direction: "lower_is_better" };
        verification = p.warnings.length === 0 && i.method === "share_text" ? "verified" : "user_confirmed";
      } else {
        if (typed == null || !Number.isFinite(typed) || typed < 1) return { ok: false, error: "Enter your error multiplier (1 or higher). Lower is better." };
        score_numeric = typed;
        score_data = { multiplier: typed, display: `${typed}×`, direction: "lower_is_better" };
        verification = "user_confirmed";
      }
    }
  } else {
    score_numeric = i.score ?? null;
    score_data = { display: i.scoreDisplay ?? null, raw: i.rawText ?? null };
    verification = i.method === "manual" ? "user_confirmed" : "unverified";
  }

  const { data: existing } = await sb.from("game_results").select("id, score_data, score_numeric, verification_status, submission_method").eq("user_id", user.id).eq("game_id", gameId).eq("game_date", i.gameDate).maybeSingle();
  let hasAnswers = false;
  if (existing) hasAnswers = ((await sb.from("krillion_answers").select("id", { count: "exact", head: true }).eq("game_result_id", existing.id)).count ?? 0) > 0;

  const merged = mergeResult(existing ? { score_data: existing.score_data, score_numeric: existing.score_numeric, verification_status: existing.verification_status, submission_method: existing.submission_method, hasAnswers } : null,
    { score_data, score_numeric, verification_status: verification, submission_method: i.method, answers });

  const { data: saved, error } = await sb.from("game_results")
    .upsert({ user_id: user.id, game_id: gameId, game_date: i.gameDate, ...merged.row }, { onConflict: "user_id,game_id,game_date" })
    .select("id").single();
  if (error || !saved) return { ok: false, error: "Couldn't save that. Please try again." };

  if (merged.replaceAnswers && answers.length) {
    await sb.from("krillion_answers").delete().eq("game_result_id", saved.id);
    const ins = await sb.from("krillion_answers").insert(answers.map((a) => ({ game_result_id: saved.id, question_number: a.questionNumber, question_text: a.questionText, answer_text: a.answerText, points: a.points, rarity_indicator: a.rarityIndicator })));
    if (ins.error) return { ok: false, error: "Saved your score, but not the answers. Please retry the screenshot." };
  }
  if (i.screenshotPath?.startsWith(`${user.id}/`)) await sb.from("result_screenshots").insert({ game_result_id: saved.id, user_id: user.id, storage_path: i.screenshotPath });

  revalidatePath("/"); revalidatePath("/results"); revalidatePath("/groups");
  return { ok: true, status: merged.changed };
}

export async function deleteResult(resultId: string) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const };
  const { data: shots } = await sb.from("result_screenshots").select("storage_path").eq("game_result_id", resultId);
  if (shots?.length) await sb.storage.from("result-screenshots").remove(shots.map((s) => s.storage_path));
  await sb.from("game_results").delete().eq("id", resultId).eq("user_id", user.id);
  revalidatePath("/"); revalidatePath("/results");
  return { ok: true as const };
}

export async function setMysteryReaction(date: string, reaction: "loved" | "okay" | "not_for_me") {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const };
  const done = await sb.from("game_results").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("game_date", date);
  if (!done.count) return { ok: false as const }; // reactions come after playing
  await sb.from("mystery_game_reactions").upsert({ user_id: user.id, game_date: date, reaction }, { onConflict: "user_id,game_date" });
  return { ok: true as const };
}
