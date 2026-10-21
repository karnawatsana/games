import { KRILLION_MAX_PER_ANSWER, KRILLION_MAX_TOTAL, KRILLION_QUESTIONS, type KrillionExtraction } from "./schema";

export type Issue = { code: string; severity: "error" | "warn"; message: string; questionNumber?: number };

export function normalizeHandle(h: string | null | undefined): string {
  return (h ?? "").trim().replace(/^@/, "").toLowerCase();
}

/**
 * Checks an extraction before it is shown for review. Errors block saving until the user fixes them;
 * warnings are highlighted. `requiresReview` is always true for screenshot extractions: the user confirms.
 */
export function validateExtraction(x: KrillionExtraction, ctx: { username?: string | null } = {}): { issues: Issue[]; requiresReview: true } {
  const issues: Issue[] = [];
  const add = (i: Issue) => issues.push(i);

  if (x.totalScore == null) add({ code: "total_missing", severity: "error", message: "Total score wasn't readable." });
  else if (x.totalScore < 0 || x.totalScore > KRILLION_MAX_TOTAL) add({ code: "total_range", severity: "error", message: `Total must be 0–${KRILLION_MAX_TOTAL}.` });

  const nums = x.answers.map((a) => a.questionNumber);
  const unique = new Set(nums);
  if (unique.size !== nums.length) add({ code: "duplicate_questions", severity: "error", message: "Some question numbers appear twice." });
  if (unique.size !== KRILLION_QUESTIONS) {
    const missing = Array.from({ length: KRILLION_QUESTIONS }, (_, i) => i + 1).filter((n) => !unique.has(n));
    add({ code: "answer_count", severity: "error", message: `Expected ${KRILLION_QUESTIONS} answers; missing ${missing.join(", ")}.` });
  }

  for (const a of x.answers) {
    if (a.points < 0 || a.points > KRILLION_MAX_PER_ANSWER) add({ code: "points_range", severity: "error", message: `Q${a.questionNumber}: points out of range.`, questionNumber: a.questionNumber });
    if (a.points % 10 !== 0) add({ code: "points_unusual", severity: "warn", message: `Q${a.questionNumber}: ${a.points} isn't a multiple of 10. Please check.`, questionNumber: a.questionNumber });
    if (a.uncertain) add({ code: "uncertain", severity: "warn", message: `Q${a.questionNumber}: text may be misread.`, questionNumber: a.questionNumber });
  }

  if (x.totalScore != null && x.answers.length === KRILLION_QUESTIONS) {
    const sum = x.answers.reduce((s, a) => s + a.points, 0);
    if (sum !== x.totalScore) add({ code: "sum_mismatch", severity: "error", message: `Answers add up to ${sum}, but the total shows ${x.totalScore}.` });
  }

  if (!x.playerHandle) add({ code: "handle_missing", severity: "warn", message: "No player name visible. Confirm this is your result." });
  else if (ctx.username && normalizeHandle(x.playerHandle) !== normalizeHandle(ctx.username))
    add({ code: "handle_mismatch", severity: "error", message: `This result belongs to ${x.playerHandle}, not @${ctx.username}.` });

  if (x.multiplePlayersVisible) add({ code: "multi_player", severity: "warn", message: "The screenshot shows more than one player. Only the block for the name above was used." });
  if (!x.gameDate) add({ code: "date_missing", severity: "warn", message: "No game date in the screenshot. Confirm which day you played." });

  return { issues, requiresReview: true };
}

export const hasBlockingIssues = (issues: Issue[]) => issues.some((i) => i.severity === "error");
