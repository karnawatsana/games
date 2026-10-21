import { z } from "zod";

export const KRILLION_QUESTIONS = 7;
export const KRILLION_MAX_TOTAL = 700;
export const KRILLION_MAX_PER_ANSWER = 100; // 700 / 7

export const AnswerSchema = z.object({
  questionNumber: z.number().int().min(1).max(KRILLION_QUESTIONS),
  questionText: z.string().min(1),
  answerText: z.string().min(1),
  points: z.number().int().min(0).max(KRILLION_MAX_PER_ANSWER),
  /** Short visual description of the rarity icon/colour as shown (e.g. "red squid icon"). Never an invented rarity name. */
  rarityIndicator: z.string().nullable(),
  /** Model's own flag for text it could not read confidently. */
  uncertain: z.boolean().default(false),
});

export const ExtractionSchema = z.object({
  game: z.literal("krillion"),
  /** Handle of the player whose result block was extracted, exactly as shown (with leading @ if shown). */
  playerHandle: z.string().nullable(),
  totalScore: z.number().int().min(0).max(KRILLION_MAX_TOTAL).nullable(),
  /** ISO date YYYY-MM-DD, or a game number string, only if visibly printed. Otherwise null. */
  gameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  gameId: z.string().nullable(),
  answers: z.array(AnswerSchema).max(KRILLION_QUESTIONS),
  /** True when the model saw several players' blocks and chose one. */
  multiplePlayersVisible: z.boolean().default(false),
  notes: z.string().nullable().default(null),
});

export type KrillionExtraction = z.infer<typeof ExtractionSchema>;
export type KrillionAnswer = z.infer<typeof AnswerSchema>;
