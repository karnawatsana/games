import { describe, expect, it } from "vitest";
import { activeStreak, canSeeAnswers, completedOn, dailyBoard, longestStreak, personalBest, rankGameScores, weeklyBoard, type ResultRow } from "@/lib/stats";
import { addDays, productDate, weekBounds } from "@/lib/dates";
import { selectMystery } from "@/lib/mystery";

const r = (user_id: string, game_slug: string, game_date: string, score_numeric: number | null = null): ResultRow => ({ user_id, game_slug, game_date, verification: "user_confirmed", score_numeric });
const three = (u: string, d: string) => [r(u, "krillion", d), r(u, "fermi", d), r(u, "mystery", d)];

describe("completion", () => {
  it("counts distinct submitted games only", () => {
    expect(completedOn([r("a", "krillion", "2026-10-21"), r("a", "krillion", "2026-10-21"), r("b", "fermi", "2026-10-21")], "a", "2026-10-21")).toEqual(["krillion"]);
  });
  it("marks ties explicitly and doesn't order-imply a winner", () => {
    const rows = [...three("a", "2026-10-21"), ...three("b", "2026-10-21"), r("c", "fermi", "2026-10-21")];
    const board = dailyBoard(rows, ["a", "b", "c"], "2026-10-21");
    expect(board.find((e) => e.userId === "a")).toMatchObject({ rank: 1, tied: true });
    expect(board.find((e) => e.userId === "b")).toMatchObject({ rank: 1, tied: true });
    expect(board.find((e) => e.userId === "c")).toMatchObject({ rank: 3, tied: false });
  });
  it("includes members with no results at 0", () => expect(dailyBoard([], ["a"], "2026-10-21")[0]).toMatchObject({ completed: 0, rank: 1 }));
});

describe("streaks", () => {
  const days = ["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-21"];
  const rows = days.map((d) => r("a", "krillion", d));
  it("active streak breaks on a missed day", () => expect(activeStreak(rows, "a", "2026-10-21")).toBe(1));
  it("today unplayed keeps yesterday's streak alive", () => expect(activeStreak(days.slice(0, 3).map((d) => r("a", "fermi", d)), "a", "2026-10-20")).toBe(3));
  it("longest streak", () => expect(longestStreak(rows, "a")).toBe(3));
  it("is zero with no recent play", () => expect(activeStreak(rows, "a", "2026-11-30")).toBe(0));
});

describe("weekly board", () => {
  it("counts the current Mon–Sun week and all-three days", () => {
    expect(weekBounds("2026-10-21")).toEqual({ start: "2026-10-19", end: "2026-10-25" });
    const rows = [...three("a", "2026-10-19"), r("a", "fermi", "2026-10-20"), ...three("b", "2026-10-12")];
    const [first, second] = weeklyBoard(rows, ["a", "b"], "2026-10-21");
    expect(first).toMatchObject({ userId: "a", gamesCompleted: 4, allThreeDays: 1, rank: 1 });
    expect(second).toMatchObject({ userId: "b", gamesCompleted: 0 });
  });
  it("handles week/month boundaries", () => expect(weekBounds("2026-11-01")).toEqual({ start: "2026-10-26", end: "2026-11-01" }));
});

describe("score direction", () => {
  const e = [{ userId: "a", score: 310 }, { userId: "b", score: 450 }, { userId: "c", score: 450 }, { userId: "d", score: null }];
  it("higher is better (Krillion)", () => {
    const ranked = rankGameScores(e, "higher_better")!;
    expect(ranked.map((x) => [x.userId, x.rank])).toEqual([["b", 1], ["c", 1], ["a", 3]]);
  });
  it("lower is better (Fermi multiplier)", () => expect(rankGameScores([{ userId: "a", score: 2.4 }, { userId: "b", score: 1.3 }], "lower_better")!.map((x) => x.userId)).toEqual(["b", "a"]));
  it("completion-only games have no ranking", () => expect(rankGameScores(e, "none")).toBeNull());
  it("personal best respects direction", () => {
    expect(personalBest([310, 500, 120], "higher_better")).toBe(500);
    expect(personalBest([2.4, 1.3], "lower_better")).toBe(1.3);
    expect(personalBest([1], "none")).toBeNull();
  });
});

describe("spoiler protection", () => {
  const base = { viewerId: "v", ownerId: "o", ownerSharesAnswers: true, viewerFinished: false };
  it("hides until the viewer finished", () => expect(canSeeAnswers(base)).toBe(false));
  it("shows after finishing (score-only counts as finished)", () => expect(canSeeAnswers({ ...base, viewerFinished: true })).toBe(true));
  it("allows explicit reveal", () => expect(canSeeAnswers({ ...base, spoilerRevealed: true })).toBe(true));
  it("never overrides the owner's privacy choice", () => expect(canSeeAnswers({ ...base, viewerFinished: true, ownerSharesAnswers: false })).toBe(false));
  it("owner always sees own", () => expect(canSeeAnswers({ ...base, viewerId: "o" })).toBe(true));
});

describe("product date / timezone boundaries (America/New_York)", () => {
  it("is still the previous day at 03:30 UTC (11:30pm EDT)", () => expect(productDate(new Date("2026-10-21T03:30:00Z"))).toBe("2026-10-20"));
  it("rolls over at local midnight (04:00 UTC in EDT)", () => expect(productDate(new Date("2026-10-21T04:00:00Z"))).toBe("2026-10-21"));
  it("handles DST end (Nov 1 2026): midnight is 05:00 UTC after the fallback", () => {
    expect(productDate(new Date("2026-11-02T04:59:00Z"))).toBe("2026-11-01");
    expect(productDate(new Date("2026-11-02T05:00:00Z"))).toBe("2026-11-02");
  });
  it("handles DST start (Mar 8 2026)", () => {
    expect(productDate(new Date("2026-03-08T04:59:00Z"))).toBe("2026-03-07");
    expect(productDate(new Date("2026-03-08T05:00:00Z"))).toBe("2026-03-08");
  });
  it("addDays crosses month ends", () => expect(addDays("2026-10-31", 1)).toBe("2026-11-01"));
});

describe("mystery selection", () => {
  const pool = ["a", "b", "c"].map((id) => ({ id, active: true }));
  it("scheduled row wins", () => expect(selectMystery({ date: "2026-10-21", schedule: [{ game_date: "2026-10-21", mystery_game_id: "c" }], pool, history: [] })).toEqual({ gameId: "c", source: "scheduled" }));
  it("is deterministic per date (same for everyone)", () => {
    const a = selectMystery({ date: "2026-10-21", schedule: [], pool, history: [] });
    expect(selectMystery({ date: "2026-10-21", schedule: [], pool: [...pool].reverse(), history: [] })).toEqual(a);
  });
  it("avoids recent repeats", () => {
    const history = [{ game_date: "2026-10-20", mystery_game_id: "a" }, { game_date: "2026-10-19", mystery_game_id: "b" }];
    expect(selectMystery({ date: "2026-10-21", schedule: [], pool, history })?.gameId).toBe("c");
  });
  it("ignores inactive games and uses the explicit fallback only when the pool is empty", () => {
    expect(selectMystery({ date: "2026-10-21", schedule: [], pool: [{ id: "a", active: false }], history: [], fallbackId: "fb" })).toEqual({ gameId: "fb", source: "fallback" });
    expect(selectMystery({ date: "2026-10-21", schedule: [], pool: [], history: [] })).toBeNull();
  });
  it("falls back to least-recently-used when everything is on cooldown", () => {
    const history = [{ game_date: "2026-10-20", mystery_game_id: "a" }, { game_date: "2026-10-19", mystery_game_id: "b" }, { game_date: "2026-10-18", mystery_game_id: "c" }];
    expect(selectMystery({ date: "2026-10-21", schedule: [], pool, history })?.gameId).toBe("c");
  });
});

import { byPlayer, byQuestion } from "@/lib/compare";
describe("krillion answer comparison", () => {
  const rows = [
    { userId: "a", questionNumber: 1, questionText: "Q1", answerText: "Severance", points: 30, rarity: null },
    { userId: "b", questionNumber: 1, questionText: "Q1", answerText: " severance ", points: 30, rarity: null },
    { userId: "c", questionNumber: 1, questionText: "Q1", answerText: "The Wire", points: 60, rarity: null },
    { userId: "a", questionNumber: 2, questionText: "Q2", answerText: "Pistachio", points: 10, rarity: null },
  ];
  it("finds top answers and matching answers (case/space-insensitive)", () => {
    const q1 = byQuestion(rows)[0];
    expect(q1.entries.map((e) => e.userId)).toEqual(["c", "a", "b"]);
    expect(q1.entries[0]).toMatchObject({ top: true, matchCount: 1 });
    expect(q1.entries.find((e) => e.userId === "a")).toMatchObject({ top: false, matchCount: 2 });
  });
  it("doesn't call a lone answer 'top'", () => expect(byQuestion(rows)[1].entries[0].top).toBe(false));
  it("groups by player with totals", () => expect(byPlayer(rows).map((p) => [p.userId, p.total])).toEqual([["c", 60], ["a", 40], ["b", 30]]));
});
