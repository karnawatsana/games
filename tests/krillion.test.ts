import { describe, expect, it } from "vitest";
import { ExtractionSchema } from "@/lib/krillion/schema";
import { hasBlockingIssues, validateExtraction } from "@/lib/krillion/validate";
import { parseKrillionShare } from "@/lib/krillion/shareText";
import { KRILLION_FIXTURE as F } from "./fixtures/krillion-expected";

const clone = () => structuredClone(F);
const codes = (x: typeof F, username?: string) => validateExtraction(x, { username }).issues.map((i) => i.code);

describe("krillion extraction schema", () => {
  it("accepts the known fixture", () => expect(ExtractionSchema.safeParse(F).success).toBe(true));
  it("fixture answers sum to the total", () => expect(F.answers.reduce((s, a) => s + a.points, 0)).toBe(310));
  it("rejects score over 700 and bad question numbers", () => {
    expect(ExtractionSchema.safeParse({ ...F, totalScore: 701 }).success).toBe(false);
    const bad = clone(); bad.answers[0].questionNumber = 8;
    expect(ExtractionSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects per-answer points over 100", () => {
    const bad = clone(); bad.answers[0].points = 101;
    expect(ExtractionSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects a non-ISO date", () => expect(ExtractionSchema.safeParse({ ...F, gameDate: "yesterday" }).success).toBe(false));
});

describe("krillion validation", () => {
  it("passes the fixture for the right user, only asking to confirm the date", () => {
    const { issues } = validateExtraction(F, { username: "sanakarnawat" });
    expect(hasBlockingIssues(issues)).toBe(false);
    expect(issues.map((i) => i.code)).toContain("date_missing");
  });
  it("blocks when the sum doesn't match the total", () => {
    const x = clone(); x.totalScore = 320;
    expect(codes(x, "sanakarnawat")).toContain("sum_mismatch");
  });
  it("blocks when fewer than 7 answers", () => {
    const x = clone(); x.answers = x.answers.slice(0, 6);
    expect(codes(x, "sanakarnawat")).toContain("answer_count");
  });
  it("blocks duplicate question numbers", () => {
    const x = clone(); x.answers[1].questionNumber = 1;
    expect(codes(x, "sanakarnawat")).toContain("duplicate_questions");
  });
  it("blocks another player's result (never mixes players)", () => {
    const issues = validateExtraction(F, { username: "someoneelse" }).issues;
    expect(issues.find((i) => i.code === "handle_mismatch")?.severity).toBe("error");
    expect(hasBlockingIssues(issues)).toBe(true);
  });
  it("handle comparison ignores @ and case", () => expect(codes(F, "SanaKarnawat")).not.toContain("handle_mismatch"));
  it("warns when the handle is missing", () => {
    const x = clone(); x.playerHandle = null;
    expect(codes(x, "sanakarnawat")).toContain("handle_missing");
  });
  it("flags uncertain and unusual values as warnings", () => {
    const x = clone(); x.answers[2].uncertain = true; x.answers[3].points = 35; x.totalScore = 315;
    const issues = validateExtraction(x, { username: "sanakarnawat" }).issues;
    expect(issues.filter((i) => i.severity === "warn").map((i) => i.code)).toEqual(expect.arrayContaining(["uncertain", "points_unusual"]));
  });
});

describe("krillion share text (format unverified; conservative)", () => {
  it("reads a score out of 700", () => expect(parseKrillionShare("Krillion #12\n310/700").totalScore).toBe(310));
  it("ignores impossible scores", () => expect(parseKrillionShare("Krillion 950/700").totalScore).toBeNull());
  it("doesn't recognise unrelated text", () => expect(parseKrillionShare("hello world").recognized).toBe(false));
});
