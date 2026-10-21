import { describe, expect, it } from "vitest";
import { FERMI_ANCHOR, fermiDateForNumber, geometricMean, parseFermiShare } from "@/lib/fermi/parse";

// Genuine share text copied from fermi.gg (No. 87).
const REAL = `Fermi · No. 87
01  1.00×
02  3.00×
03  22.9×
─────────
4.09× score · top 46%
<https://fermi.gg/s/daily>`;

describe("fermi share text (real format)", () => {
  const p = parseFermiShare(REAL);
  it("recognises the format", () => expect(p.recognized).toBe(true));
  it("reads the puzzle number, score and percentile", () => {
    expect(p.puzzleNumber).toBe(87);
    expect(p.overall).toEqual({ value: 4.09, display: "4.09×" });
    expect(p.topPercent).toBe(46);
  });
  it("reads all three questions with exact representation", () => {
    expect(p.questions.map((q) => [q.n, q.multiplier, q.display])).toEqual([[1, 1, "1.00×"], [2, 3, "3.00×"], [3, 22.9, "22.9×"]]);
  });
  it("keeps the direction: lower is better", () => expect(p.direction).toBe("lower_is_better"));
  it("is internally consistent (overall = geometric mean)", () => {
    expect(p.warnings).toEqual([]);
    // the game shows 4.09; the mean of the *rounded* per-question values is 4.0956, so it computes from unrounded values or truncates
    expect(geometricMean([1, 3, 22.9])).toBeCloseTo(4.09, 1);
  });
  it("finds the share link", () => expect(p.url).toBe("https://fermi.gg/s/daily"));
  it("tolerates plain x, extra spacing and Windows newlines", () => {
    const q = parseFermiShare(REAL.replace(/×/g, "x").replace(/\n/g, "\r\n"));
    expect(q.recognized).toBe(true);
    expect(q.overall?.value).toBe(4.09);
  });
  it("preserves '<' bounds from the card instead of dropping or reinterpreting them", () => {
    const q = parseFermiShare("Fermi · No. 87\n01  1.00×\n02  < 3.00×\n03  < 22.9×\n4.09× score · top 46%");
    expect(q.questions[1]).toMatchObject({ multiplier: 3, bound: "lt" });
  });
  it("flags a score that doesn't match the questions", () => expect(parseFermiShare(REAL.replace("4.09×", "9.99×")).warnings[0]).toMatch(/average 4\.10×, not 9\.99×/));
  it("doesn't invent data from unrelated text", () => {
    const q = parseFermiShare("lol that was hard, got like 5x");
    expect(q).toMatchObject({ recognized: false, puzzleNumber: null, overall: null, questions: [] });
  });
  it("doesn't recognise a missing score", () => expect(parseFermiShare("Fermi · No. 87\n01  1.00×").recognized).toBe(false));
});

describe("fermi puzzle number → date", () => {
  it("matches the anchor from the real card", () => expect(fermiDateForNumber(FERMI_ANCHOR.number)).toBe("2026-10-21"));
  it("counts days forward and back across a month", () => {
    expect(fermiDateForNumber(88)).toBe("2026-10-22");
    expect(fermiDateForNumber(97)).toBe("2026-10-31");
    expect(fermiDateForNumber(98)).toBe("2026-11-01");
    expect(fermiDateForNumber(86)).toBe("2026-10-20");
  });
});

import { checkFermi, FermiExtractionSchema } from "@/lib/fermi/schema";
describe("fermi card extraction schema", () => {
  const good = { game: "fermi" as const, puzzleNumber: 87, gameDate: "2026-10-21", score: 4.09, topPercent: 46, questions: [1, 3, 22.9].map((m, i) => ({ questionNumber: i + 1, questionText: "q", multiplier: m, lessThan: i > 0 })) };
  it("accepts the known card", () => { expect(FermiExtractionSchema.safeParse(good).success).toBe(true); expect(checkFermi(good)).toEqual([]); });
  it("rejects a multiplier under 1×", () => expect(FermiExtractionSchema.safeParse({ ...good, score: 0.5 }).success).toBe(false));
  it("warns when the score doesn't match the questions", () => expect(checkFermi({ ...good, score: 9 })[0]).toMatch(/average/));
  it("asks for the day when neither date nor number is visible", () => expect(checkFermi({ ...good, gameDate: null, puzzleNumber: null }).join(" ")).toMatch(/Confirm which day/));
});
