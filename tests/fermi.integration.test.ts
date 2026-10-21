import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractFermi } from "@/lib/fermi/extract";
import { checkFermi } from "@/lib/fermi/schema";

// Real Claude Vision call on the real Fermi card. Skipped (not faked) without ANTHROPIC_API_KEY.
describe.skipIf(!process.env.ANTHROPIC_API_KEY)("fermi card extraction (live)", () => {
  it("reads No. 87: 4.09×, top 46%, and the three question values", async () => {
    const x = await extractFermi(readFileSync("tests/fixtures/fermi-card.png"));
    expect(x.puzzleNumber).toBe(87);
    expect(x.gameDate).toBe("2026-10-21");
    expect(x.score).toBe(4.09);
    expect(x.topPercent).toBe(46);
    expect(x.questions.map((q) => q.multiplier)).toEqual([1, 3, 22.9]);
    expect(x.questions[0].questionText).toMatch(/steps.*marathon/i);
    expect(checkFermi(x)).toEqual([]);
  }, 60_000);
});
