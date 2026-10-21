import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractKrillion } from "@/lib/krillion/extract";
import { validateExtraction, hasBlockingIssues } from "@/lib/krillion/validate";
import { KRILLION_FIXTURE as F } from "./fixtures/krillion-expected";

// Real Claude Vision call against the real screenshot. Skipped (not faked) without ANTHROPIC_API_KEY.
describe.skipIf(!process.env.ANTHROPIC_API_KEY)("krillion vision extraction (live)", () => {
  it("extracts 310 and the seven answers for the player's own block only", async () => {
    const png = readFileSync("tests/fixtures/krillion-screenshot.png");
    const x = await extractKrillion(png, { expectedHandle: "sanakarnawat" });
    expect(x.totalScore).toBe(310);
    expect(x.answers.map((a) => [a.questionNumber, a.answerText.toLowerCase(), a.points])).toEqual(
      F.answers.map((a) => [a.questionNumber, a.answerText.toLowerCase(), a.points]),
    );
    // must not pick up the other player's rows above the header ("Czech Republic", "Pet in cabin")
    expect(x.answers.some((a) => /czech|pet in cabin/i.test(a.answerText))).toBe(false);
    expect(hasBlockingIssues(validateExtraction(x, { username: "sanakarnawat" }).issues)).toBe(false);
  }, 60_000);
});
