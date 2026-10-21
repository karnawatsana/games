import { z } from "zod";
import { geometricMean } from "./parse";

export const FermiExtractionSchema = z.object({
  game: z.literal("fermi"),
  puzzleNumber: z.number().int().min(1).nullable(),
  /** ISO date only if printed on the card (e.g. "October 21st, 2026" → 2026-10-21). */
  gameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  score: z.number().min(1).nullable(),
  topPercent: z.number().min(0).max(100).nullable(),
  questions: z.array(z.object({
    questionNumber: z.number().int().min(1).max(10),
    questionText: z.string().nullable(),
    multiplier: z.number().min(1),
    /** True when the card shows a "<" before the value. Reported, never interpreted. */
    lessThan: z.boolean().default(false),
  })).max(10),
});
export type FermiExtraction = z.infer<typeof FermiExtractionSchema>;

export function checkFermi(x: FermiExtraction): string[] {
  const w: string[] = [];
  if (x.score == null) w.push("Score wasn't readable.");
  if (!x.questions.length) w.push("No per-question values were readable.");
  if (x.score != null && x.questions.length) {
    const gm = geometricMean(x.questions.map((q) => q.multiplier));
    if (Math.abs(gm - x.score) / x.score > 0.015) w.push(`The questions average ${gm.toFixed(2)}×, not ${x.score}×. Please check.`);
  }
  if (!x.gameDate && x.puzzleNumber == null) w.push("No date or puzzle number visible. Confirm which day you played.");
  return w;
}
