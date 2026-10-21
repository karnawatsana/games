import { describe, expect, it } from "vitest";
import { mergeResult } from "@/lib/results/merge";

const score = (n: number, v: "verified" | "user_confirmed" | "unverified", method = "share_text") => ({ score_data: { total: n }, score_numeric: n, verification_status: v, submission_method: method });

describe("krillion duplicate submissions", () => {
  it("creates when nothing exists", () => expect(mergeResult(null, score(310, "verified")).changed).toBe("created"));
  it("score first, then screenshot enriches the same record with answers", () => {
    const first = { ...score(310, "verified"), hasAnswers: false };
    const m = mergeResult(first, { ...score(310, "verified", "screenshot"), answers: new Array(7).fill({}) });
    expect(m.changed).toBe("enriched");
    expect(m.replaceAnswers).toBe(true);
    expect(m.row.submission_method).toBe("screenshot");
  });
  it("a manual score can't overwrite a verified result", () => {
    const m = mergeResult({ ...score(310, "verified"), hasAnswers: true }, score(999, "user_confirmed", "manual"));
    expect(m.row.score_numeric).toBe(310);
    expect(m.row.verification_status).toBe("verified");
    expect(m.replaceAnswers).toBe(false);
  });
  it("equal evidence with a different score is a correction", () => expect(mergeResult({ ...score(300, "verified"), hasAnswers: false }, score(310, "verified")).changed).toBe("corrected"));
  it("score-only resubmission doesn't drop existing answers", () => expect(mergeResult({ ...score(310, "verified", "screenshot"), hasAnswers: true }, score(310, "verified")).replaceAnswers).toBe(false));
  it("identical resubmission is unchanged", () => expect(mergeResult({ ...score(310, "verified"), hasAnswers: false }, score(310, "verified")).changed).toBe("unchanged"));
});
