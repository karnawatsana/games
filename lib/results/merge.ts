export type Verification = "verified" | "user_confirmed" | "unverified";
export type Stored = { score_data: Record<string, unknown>; score_numeric: number | null; verification_status: Verification; submission_method: string; hasAnswers?: boolean };
export type Incoming = Omit<Stored, "hasAnswers"> & { answers?: unknown[] | null };

const rank: Record<Verification, number> = { unverified: 0, user_confirmed: 1, verified: 2 };

/**
 * One canonical result per user/game/date. A later submission enriches or corrects it rather than duplicating:
 * - never downgrade verification (a manual score can't overwrite a verified screenshot's score);
 * - equal-or-stronger evidence replaces the score; weaker evidence only fills gaps;
 * - answers from a full screenshot are kept/added, never dropped by a score-only resubmission.
 */
export function mergeResult(existing: Stored | null, incoming: Incoming): { row: Omit<Stored, "hasAnswers">; replaceAnswers: boolean; changed: "created" | "enriched" | "corrected" | "unchanged" } {
  const row = { score_data: incoming.score_data, score_numeric: incoming.score_numeric, verification_status: incoming.verification_status, submission_method: incoming.submission_method };
  const hasNewAnswers = !!incoming.answers?.length;
  if (!existing) return { row, replaceAnswers: hasNewAnswers, changed: "created" };

  const stronger = rank[incoming.verification_status] >= rank[existing.verification_status];
  if (!stronger) {
    // weaker evidence: keep stored score/verification; fill only a missing numeric score
    const keep = { ...existing, hasAnswers: undefined } as Omit<Stored, "hasAnswers">;
    delete (keep as Stored).hasAnswers;
    return { row: { ...keep, score_numeric: existing.score_numeric ?? incoming.score_numeric }, replaceAnswers: false, changed: existing.score_numeric == null && incoming.score_numeric != null ? "enriched" : "unchanged" };
  }
  const scoreChanged = existing.score_numeric !== incoming.score_numeric;
  return {
    row: { ...row, score_data: { ...existing.score_data, ...incoming.score_data } },
    replaceAnswers: hasNewAnswers,
    changed: hasNewAnswers && !existing.hasAnswers ? "enriched" : scoreChanged ? "corrected" : hasNewAnswers ? "corrected" : "unchanged",
  };
}
