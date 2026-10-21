import { KRILLION_MAX_TOTAL } from "./schema";

export type ParsedShare = { totalScore: number | null; gameDate: string | null; gameId: string | null; recognized: boolean; confidence: "low" | "medium" };

/**
 * Best-effort parser for pasted Krillion share text.
 *
 * NOTE: the exact share format has not been verified against a real sample (krillion.io was
 * unreachable from the build environment). This parser is intentionally conservative: it only
 * returns a score it finds next to the game's 700-point maximum or a clear "score" label, and the
 * UI always shows the parsed value for confirmation. Send a real share example to harden it.
 */
export function parseKrillionShare(text: string): ParsedShare {
  const t = text.replace(/ /g, " ");
  const mentions = /krillion/i.test(t);
  let score: number | null = null;

  const outOf = t.match(/(\d{1,3})\s*(?:\/|out of|of)\s*700\b/i);
  if (outOf) score = Number(outOf[1]);
  if (score == null) {
    const labelled = t.match(/\b(?:score|points?|pts)\b\s*[:=\-]?\s*(\d{1,3})\b/i);
    if (labelled) score = Number(labelled[1]);
  }
  if (score != null && (score < 0 || score > KRILLION_MAX_TOTAL)) score = null;

  const iso = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  const id = t.match(/#\s?(\d{1,5})\b/);
  return {
    totalScore: score,
    gameDate: iso ? iso[0] : null,
    gameId: id ? id[1] : null,
    recognized: mentions && score != null,
    confidence: outOf && mentions ? "medium" : "low",
  };
}
